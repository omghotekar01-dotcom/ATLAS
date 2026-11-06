/** Read-only, bounded lookup of 4byte.directory's UNVERIFIED community submissions.
 * This data is never sent into the Arkiv importer or used to select a safe ABI.
 */
import {
  CommunityLookupResultSchema,
  UpstreamUnavailableError,
  type CommunityLookupResult,
} from "@atlas/schemas";
import { parseSelectorInput } from "./resolver.js";

const FOURBYTE_URL = "https://www.4byte.directory/api/v1/signatures/";
const MAX_RESULTS = 20;
const UPSTREAM_PAGE = 100;

interface CommunityFetchOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

export async function lookupCommunity(
  selectorInput: string,
  options: CommunityFetchOptions = {},
): Promise<CommunityLookupResult> {
  const selector = parseSelectorInput(selectorInput);
  const url = new URL(FOURBYTE_URL);
  url.searchParams.set("hex_signature", selector);
  url.searchParams.set("page_size", String(UPSTREAM_PAGE));
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) {
    throw new Error("Invalid upstream timeout configuration");
  }
  let input: unknown;
  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    if (body.length > 250_000) throw new Error("Oversized upstream response");
    input = JSON.parse(body);
  } catch (cause) {
    throw new UpstreamUnavailableError(
      "4byte.directory lookup is temporarily unavailable.",
      {
        registry: "4byte.directory",
      },
      { cause },
    );
  }

  // Avoid importing zod into core. Validate the external document before mapping.
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new UpstreamUnavailableError("4byte.directory returned an invalid response.");
  }
  const payload = input as Record<string, unknown>;
  if (
    !Number.isSafeInteger(payload.count) ||
    (payload.count as number) < 0 ||
    !Array.isArray(payload.results)
  ) {
    throw new UpstreamUnavailableError("4byte.directory returned an invalid response.");
  }
  const candidates: { id: number; signature: string; selector: typeof selector }[] = [];
  const seen = new Set<number>();
  let ignored = 0;
  for (const row of payload.results as unknown[]) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      ignored++;
      continue;
    }
    const item = row as Record<string, unknown>;
    if (
      typeof item.hex_signature !== "string" ||
      item.hex_signature.toLowerCase() !== selector ||
      !Number.isSafeInteger(item.id) ||
      (item.id as number) < 0 ||
      typeof item.text_signature !== "string" ||
      !item.text_signature.trim() ||
      item.text_signature.length > 512
    ) {
      ignored++;
      continue;
    }
    const id = item.id as number;
    if (seen.has(id)) continue;
    seen.add(id);
    candidates.push({ id, signature: item.text_signature.trim(), selector });
  }
  candidates.sort((a, b) => a.id - b.id);
  const total = payload.count as number;
  const truncated =
    total > candidates.length || candidates.length > MAX_RESULTS || Boolean(payload.next);
  const limited = candidates.slice(0, MAX_RESULTS);
  const warnings = [
    "Community submissions are unverified suggestions; not Arkiv canonical records, provenance, contract identity or safety evidence.",
  ];
  if (limited.length > 1)
    warnings.push("Multiple possible signatures share this selector; never assume one is correct.");
  if (truncated)
    warnings.push("Results are limited; additional 4byte.directory candidates may exist.");
  if (ignored) warnings.push("Some malformed or mismatched upstream records were discarded.");
  return CommunityLookupResultSchema.parse({
    selector,
    registry: "4byte.directory",
    canonical: false,
    candidates: limited,
    total,
    truncated,
    warnings,
  });
}
