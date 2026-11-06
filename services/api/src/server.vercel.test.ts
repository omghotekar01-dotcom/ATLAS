import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Vercel Fastify HTTP server export", () => {
  it("exports a ready native HTTP server without binding a port on Vercel", async () => {
    // Intentionally no credentials: missing Arkiv access must be reported as
    // degraded/unavailable, never replaced by fixture or made-up on-chain data.
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("ARKIV_ACCESS_KEY", "");
    vi.stubEnv("ATLAS_ARKIV_CREATOR_ADDRESS", "");
    vi.stubEnv("ATLAS_CORS_ORIGINS", "");

    const { default: server } = await import("./server.js");
    expect(typeof server.listen).toBe("function");
    expect(typeof server.emit).toBe("function");
    expect(server.listening).toBe(false);

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      server.once("error", onError);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", onError);
        resolve();
      });
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing test port");
      const origin = `http://127.0.0.1:${address.port}`;

      const health = await fetch(`${origin}/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({
        status: "degraded",
        arkiv: { connected: false },
      });

      const lookup = await fetch(`${origin}/v1/functions/0x9010d07c`);
      expect(lookup.status).toBe(502);
      expect(await lookup.json()).toMatchObject({
        error: { code: "UPSTREAM_UNAVAILABLE" },
      });

      const search = await fetch(`${origin}/v1/functions/search?q=getRoleMember`);
      expect(search.status).toBe(502);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
