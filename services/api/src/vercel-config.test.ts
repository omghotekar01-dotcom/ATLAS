import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { functionRecord, makeDependencies, memoryFunctions } from "./test-support.js";

interface VercelConfig {
  readonly buildCommand: string;
  readonly functions?: Readonly<Record<string, { readonly maxDuration: number }>>;
  readonly outputDirectory?: string;
  readonly rewrites?: readonly unknown[];
}

const config = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
) as VercelConfig;
const serverEntry = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
const catchAllEntry = new URL("../api/[...path].ts", import.meta.url);

describe("Vercel Fastify configuration", () => {
  it("uses the native Fastify server entry without rewrites or a duplicate catch-all", () => {
    expect(config.buildCommand).toBe("pnpm --filter '@atlas/api...' run build");
    expect(config.functions).toEqual({ "src/server.ts": { maxDuration: 30 } });
    expect(config.rewrites).toBeUndefined();
    expect(config.outputDirectory).toBeUndefined();
    expect(existsSync(catchAllEntry)).toBe(false);
    expect(serverEntry).toContain('import { createApp } from "./app.js"');
    expect(serverEntry).toContain("await app.listen");
  });

  it("serves direct health, lookup and search paths without a routing prefix", async () => {
    const app = createApp({
      dependencies: makeDependencies({
        functions: memoryFunctions([
          functionRecord("transfer(address,uint256)", "0x9010d07c", "a"),
        ]),
      }),
      logger: false,
      rateLimitPerMinute: 0,
    });

    try {
      const health = await app.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toMatchObject({ status: "ok", arkiv: { connected: true } });

      const lookup = await app.inject({
        method: "GET",
        url: "/v1/functions/0x9010d07c",
      });
      expect(lookup.statusCode).toBe(200);
      expect(lookup.json()).toMatchObject({
        identifier: "0x9010d07c",
        candidates: [{ signature: "transfer(address,uint256)" }],
      });

      const search = await app.inject({
        method: "GET",
        url: "/v1/functions/search?q=transfer&limit=1",
      });
      expect(search.statusCode).toBe(200);
      expect(search.json()).toMatchObject({
        items: [{ signature: "transfer(address,uint256)" }],
      });
    } finally {
      await app.close();
    }
  });
});
