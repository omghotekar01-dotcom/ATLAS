import { describe, expect, it } from "vitest";
import type { CliClient } from "./cli.js";
import { run } from "./cli.js";
const selector = "0xa9059cbb";
const result = {
  selector,
  registry: "4byte.directory" as const,
  canonical: false as const,
  candidates: [{ id: 7, selector, signature: "transfer(address,uint256)" }],
  total: 1,
  truncated: false,
  warnings: ["Community submissions are unverified suggestions."],
};

describe("4byte CLI integration", () => {
  it("prints separate provenance notices and does not require a wallet", async () => {
    const output: string[] = [];
    const code = await run(["4byte", selector], {
      client: { lookupCommunity: async () => result } as unknown as CliClient,
      stdout: (x) => output.push(x),
      stderr: (x) => {
        throw Error(x);
      },
    });
    expect(code).toBe(0);
    expect(output.join("\n")).toContain("UNVERIFIED");
    expect(output.join("\n")).toContain("transfer(address,uint256)");
  });
  it("prints parseable JSON", async () => {
    const output: string[] = [];
    const code = await run(["4byte", selector, "--json"], {
      client: { lookupCommunity: async () => result } as unknown as CliClient,
      stdout: (x) => output.push(x),
      stderr: (x) => {
        throw Error(x);
      },
    });
    expect(code).toBe(0);
    expect(JSON.parse(output.join("\n"))).toMatchObject({
      canonical: false,
      registry: "4byte.directory",
    });
  });
  it("surfaces unavailable API implementations clearly", async () => {
    const stderr: string[] = [];
    const code = await run(["4byte", selector], {
      client: {} as CliClient,
      stdout: () => {},
      stderr: (x) => stderr.push(x),
    });
    expect(code).toBe(2);
    expect(stderr.join("\n")).toContain("does not support");
  });
});
