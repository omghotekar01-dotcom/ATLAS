import { createHash } from "node:crypto";
import {
  InvalidInputError,
  NotFoundError,
  RateLimitedError,
  SwarmArtifactSchema,
  UpstreamUnavailableError,
  type SwarmArtifact,
} from "@atlas/schemas";

const MAX_BYTES = 65_536;
const REFERENCE = /^(?:0x)?([a-fA-F0-9]{64})$/;

/**
 * Read-only Bee /bytes lookup. No postage batch, Arkiv write, or browser-supplied URL.
 * The reference is a Swarm address, NOT a SHA-256 digest; sha256 describes the
 * independently retrieved bytes. Do not treat this as Arkiv provenance.
 */
export async function fetchSwarmArtifact(
  input: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<SwarmArtifact> {
  const parsed = REFERENCE.exec(input);
  if (!parsed) {
    throw new InvalidInputError("Swarm reference must contain exactly 64 hexadecimal characters.");
  }
  const reference = parsed[1]!.toLowerCase();
  const configured = env.ATLAS_BEE_URL?.trim();
  if (!configured) {
    throw new UpstreamUnavailableError(
      "Swarm artifact reads are not configured. Set ATLAS_BEE_URL on the API.",
    );
  }

  let endpoint: URL;
  try {
    const base = new URL(configured);
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== "/"
    ) {
      throw new Error("Unsupported Bee URL");
    }
    endpoint = new URL(`/bytes/${reference}`, base);
  } catch {
    throw new UpstreamUnavailableError(
      "ATLAS_BEE_URL must be an HTTP(S) Bee API origin without credentials or a path.",
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "GET",
      redirect: "error",
      headers: { accept: "application/octet-stream" },
      signal: AbortSignal.timeout(6_000),
    });
  } catch {
    throw new UpstreamUnavailableError("Swarm Bee API could not be reached or timed out.");
  }
  if (response.status === 404 || response.status === 410) {
    throw new NotFoundError("The Swarm reference was not found on the configured Bee API.");
  }
  if (response.status === 429) {
    throw new RateLimitedError("Swarm Bee API is rate limiting artifact requests.");
  }
  if (!response.ok) {
    throw new UpstreamUnavailableError("Swarm Bee API returned an unsuccessful response.");
  }

  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > MAX_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new InvalidInputError("Swarm artifact exceeds the 64 KiB inspection limit.");
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new UpstreamUnavailableError("Swarm Bee API supplied no readable response body.");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new InvalidInputError("Swarm artifact exceeds the 64 KiB inspection limit.");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof InvalidInputError) throw error;
    throw new UpstreamUnavailableError("The Swarm artifact transfer could not be completed.");
  } finally {
    reader.releaseLock();
  }

  const data = Buffer.concat(chunks, total);
  const rawType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const contentType = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(rawType)
    ? rawType.slice(0, 128)
    : "application/octet-stream";
  return SwarmArtifactSchema.parse({
    source: "swarm",
    reference,
    contentType,
    bytes: total,
    sha256: `0x${createHash("sha256").update(data).digest("hex")}`,
    contentBase64: data.toString("base64"),
  });
}
