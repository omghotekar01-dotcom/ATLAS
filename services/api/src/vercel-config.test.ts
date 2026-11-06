import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface VercelConfig {
  readonly functions: Readonly<Record<string, { readonly maxDuration: number }>>;
  readonly rewrites: readonly { readonly source: string; readonly destination: string }[];
}

const config = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
) as VercelConfig;
const functionEntry = readFileSync(new URL("../api/[...path].ts", import.meta.url), "utf8");

describe("Vercel routing configuration", () => {
  it("configures the existing catch-all entry for both API routes", () => {
    expect(config.functions["api/[...path].ts"]).toEqual({ maxDuration: 30 });
    expect(functionEntry).toContain("createVercelHandler");
    expect(config.rewrites).toEqual([
      { source: "/health", destination: "/api/health" },
      { source: "/v1/:path*", destination: "/api/v1/:path*" },
    ]);
  });
});
