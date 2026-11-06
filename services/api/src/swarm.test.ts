import { describe, expect, it, vi } from "vitest";
import { fetchSwarmArtifact } from "./swarm.js";
import { createApp } from "./app-factory.js";
import { makeDependencies } from "./test-support.js";
import { SwarmArtifactSchema } from "@atlas/schemas";

const REF = "a".repeat(64);
const BEE = { ATLAS_BEE_URL: "https://api.gateway.ethswarm.org" };
const responder = (response: Response) => vi.fn(async () => response) as unknown as typeof fetch;

describe("bounded read-only Swarm Bee client", () => {
  it("normalizes a reference and hashes the actual returned bytes", async () => {
    const mock = responder(
      new Response("hello", { headers: { "content-type": "text/plain", "content-length": "5" } }),
    );
    const result = await fetchSwarmArtifact(`0x${REF.toUpperCase()}`, BEE, mock);
    expect(result).toMatchObject({
      source: "swarm",
      reference: REF,
      bytes: 5,
      contentBase64: "aGVsbG8=",
    });
    expect(result.sha256).toBe(
      "0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
    expect(mock).toHaveBeenCalledOnce();
    const [url, request] = (mock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url.toString()).toBe(`https://api.gateway.ethswarm.org/bytes/${REF}`);
    expect(request).toMatchObject({ method: "GET", redirect: "error" });
  });

  it("rejects invalid references before making a network request", async () => {
    const mock = responder(new Response("ignored"));
    await expect(fetchSwarmArtifact("../../../metadata", BEE, mock)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(mock).not.toHaveBeenCalled();
  });

  it("fails honestly when no Bee endpoint is configured", async () => {
    await expect(fetchSwarmArtifact(REF, {})).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
  });

  it("returns NOT_FOUND for missing references and RATE_LIMITED for 429", async () => {
    await expect(
      fetchSwarmArtifact(REF, BEE, responder(new Response(null, { status: 404 }))),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      fetchSwarmArtifact(REF, BEE, responder(new Response(null, { status: 429 }))),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("enforces size limits even with no Content-Length", async () => {
    await expect(
      fetchSwarmArtifact(REF, BEE, responder(new Response("x".repeat(65_537)))),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("fails closed on an invalid backend URL or network interruption", async () => {
    await expect(fetchSwarmArtifact(REF, { ATLAS_BEE_URL: "file:///tmp/a" })).rejects.toMatchObject(
      { code: "UPSTREAM_UNAVAILABLE" },
    );
    const mock = vi.fn(async () => {
      throw new Error("secret upstream DNS data");
    }) as unknown as typeof fetch;
    await expect(fetchSwarmArtifact(REF, BEE, mock)).rejects.toThrow("could not be reached");
  });
});

describe("Swarm HTTP endpoint (no live upstream)", () => {
  it("uses the same bounded artifact contract as the CLI and SDK", async () => {
    const artifact = SwarmArtifactSchema.parse({
      source: "swarm",
      reference: REF,
      bytes: 5,
      contentType: "text/plain",
      sha256: `0x${"0".repeat(64)}`,
      contentBase64: "aGVsbG8=",
    });
    const app = createApp({
      dependencies: makeDependencies(),
      rateLimitPerMinute: 0,
      swarmLookup: async () => artifact,
    });
    try {
      const response = await app.inject({ method: "GET", url: `/v1/artifacts/${REF}` });
      expect(response.statusCode).toBe(200);
      expect(SwarmArtifactSchema.parse(response.json())).toEqual(artifact);
    } finally {
      await app.close();
    }
  });
});
