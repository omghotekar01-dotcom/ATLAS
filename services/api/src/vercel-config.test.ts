import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createApp } from "./app-factory.js";
import { functionRecord, makeDependencies, memoryFunctions } from "./test-support.js";

interface VercelConfig {
  readonly buildCommand: string;
  readonly framework: string;
  readonly functions?: Readonly<Record<string, unknown>>;
  readonly outputDirectory?: string;
  readonly rewrites?: readonly unknown[];
}

interface ApiPackage {
  readonly main: string;
  readonly types: string;
  readonly exports: {
    readonly ".": {
      readonly import: string;
      readonly types: string;
    };
  };
}

const config = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
) as VercelConfig;
const apiPackage = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as ApiPackage;
const serverEntry = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
const projectRoot = new URL("../", import.meta.url);
const sourceRoot = new URL("./", import.meta.url);
const apiFunctionsRoot = fileURLToPath(new URL("../api/", import.meta.url));
const entryPointExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".cts", ".mts"]);

function isRecognizedEntryPoint(filename: string): boolean {
  const extensionIndex = filename.lastIndexOf(".");
  if (extensionIndex < 0 || !entryPointExtensions.has(filename.slice(extensionIndex))) return false;
  return ["app", "index", "server"].includes(filename.slice(0, extensionIndex));
}

function filesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : entry.isFile() ? [path] : [];
  });
}

describe("Vercel Fastify configuration", () => {
  it("has exactly one supported Fastify entry point at src/server.ts", () => {
    const rootEntries = readdirSync(projectRoot).filter(isRecognizedEntryPoint);
    const sourceEntries = readdirSync(sourceRoot).filter(isRecognizedEntryPoint);
    const recognizedEntries = [
      ...rootEntries.map((entry) => entry),
      ...sourceEntries.map((entry) => `src/${entry}`),
    ];

    expect(recognizedEntries).toEqual(["src/server.ts"]);
    expect(filesUnder(apiFunctionsRoot)).toEqual([]);
    expect(serverEntry).toContain('import { createApp } from "./app-factory.js"');
    expect(serverEntry).toContain("await app.listen");
  });

  it("uses native Fastify routing without API functions, rewrites, or output directory", () => {
    expect(config.framework).toBe("fastify");
    expect(config.buildCommand).toBe("pnpm --filter '@atlas/api...' run build");
    expect(config.functions).toBeUndefined();
    expect(config.rewrites).toBeUndefined();
    expect(config.outputDirectory).toBeUndefined();
  });

  it("points every package runtime and type export at the renamed public API", () => {
    expect(apiPackage.main).toBe("./dist/public-api.js");
    expect(apiPackage.types).toBe("./dist/public-api.d.ts");
    expect(apiPackage.exports["."]).toEqual({
      types: "./dist/public-api.d.ts",
      import: "./dist/public-api.js",
    });
    expect(existsSync(new URL("../src/public-api.ts", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../src/app-factory.ts", import.meta.url))).toBe(true);
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
