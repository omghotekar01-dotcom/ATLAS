import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createVercelHandler } from "./vercel.js";
import { functionRecord, makeDependencies, memoryFunctions } from "./test-support.js";

describe("Vercel Fastify adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches rewritten /api paths through Fastify and preserves query parameters", async () => {
    const handler = createVercelHandler({
      dependencies: makeDependencies({
        functions: memoryFunctions([
          functionRecord("transfer(address,uint256)", "0xa9059cbb", "a"),
        ]),
      }),
      logger: false,
      rateLimitPerMinute: 0,
    });
    const server = createServer(handler);

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing test server address.");

      const health = await fetch(`http://127.0.0.1:${address.port}/api/health?probe=vercel`);
      expect(health.status).toBe(200);
      await expect(health.json()).resolves.toMatchObject({
        status: "ok",
        arkiv: { connected: true },
      });

      const search = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/functions/search?q=transfer&limit=1`,
      );
      expect(search.status).toBe(200);
      await expect(search.json()).resolves.toMatchObject({
        items: [{ signature: "transfer(address,uint256)" }],
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("returns a generic startup error without logging configuration values", async () => {
    const secret = "sensitive-origin-value";
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = createVercelHandler({
      logger: false,
      cors: {
        env: {
          ATLAS_CORS_ORIGINS: `https://studio.example.test/path?token=${secret}`,
          ATLAS_CORS_DEV_ORIGINS: "false",
        },
      },
    });
    const server = createServer(handler);

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing test server address.");

      const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
      const body = await response.text();
      expect(response.status).toBe(500);
      expect(body).not.toContain(secret);
      expect(log.mock.calls.flat().join(" ")).not.toContain(secret);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
