import { describe, expect, it, vi } from "vitest";
import type { CliClient } from "./cli.js";
import { run } from "./cli.js";
import { DEMO, investigate } from "./workflow.js";

const canonical = {
  identifier: DEMO.selector, kind: "function", registry: "arkiv-rabdi",
  ambiguous: false, warnings: [],
  candidates: [{
    signature: "getRoleMember(bytes32,uint256)", entityKey: "0x" + "a".repeat(64),
    source: "OpenZeppelin/openzeppelin-contracts",
    sourceId: "source:commit:line",
    provenance: { recordHash: "0x" + "b".repeat(64), importedAt: "2026-11-06", datasetVersion: "test" },
  }],
};
function client(override: Record<string, unknown> = {}): CliClient {
  const unused = async (): Promise<never> => { throw new Error("Unexpected method"); };
  return {
    health: unused, searchFunctions: unused, lookupEvent: unused,
    decodeLogs: unused, analyzeTransaction: unused,
    lookupFunction: async () => canonical,
    decodeCalldata: async () => ({
      selector: DEMO.selector, decoded: [{
        signature: "getRoleMember(bytes32,uint256)", decodeStatus: "success",
        arguments: [{ name: "role", type: "bytes32", value: "0x" + "0".repeat(64) }],
      }], warnings: [],
    }),
    getSwarmArtifact: async () => ({reference: DEMO.swarm, sha256: DEMO.swarmSha, bytes: 2356}),
    checkEnsV2Role: async (account: string) => ({
      chainId: 11155111, resource: "0", requiredRoles: "1",
      authorized: account.toLowerCase() === DEMO.ensYes.toLowerCase(),
      account, blockNumber: "123456",
    }),
    ...override,
  } as unknown as CliClient;
}

describe("ATLAS integrated CLI workflow", () => {
  it("investigates canonical calldata and verifies separate Swarm/ENS reads", async () => {
    const result = await investigate(client(), DEMO.calldata, { full: true, zeroG: "illustration" });
    expect(result.selector).toBe(DEMO.selector);
    expect(result.kind).toBe("calldata");
    expect(result.verified).toBe(5);
    expect(result.checks.filter((e) => e.state === "illustrative")).toHaveLength(1);
    expect(result.checks.find((e) => e.source.includes("Anon-RPC"))?.state).toBe("unverified");
    expect(result.checks.find((e) => e.state === "illustrative")?.message).toContain("Request ID: none");
  });

  it("never upgrades a community guess into an Arkiv source", async () => {
    const lookupFunction = vi.fn(async () => ({...canonical, candidates: []}));
    const lookupCommunity = vi.fn(async () => ({
      candidates: [{signature: "transfer(address,uint256)"}],
    }));
    const result = await investigate(
      client({lookupFunction, lookupCommunity}), "0xa9059cbb",
    );
    expect(result.verified).toBe(0);
    expect(result.checks[0]?.state).toBe("unavailable");
    expect(result.checks[1]?.state).toBe("unverified");
    expect(lookupCommunity).toHaveBeenCalledWith("0xa9059cbb");
  });

  it("fails closed on a different Swarm SHA-256", async () => {
    const result = await investigate(
      client({getSwarmArtifact: async () => ({
        reference: DEMO.swarm, sha256: "0x" + "0".repeat(64), bytes: 2356,
      })}),
      DEMO.selector, {full: true},
    );
    expect(result.checks.find((c) => c.source.startsWith("Swarm"))?.state).toBe("unavailable");
  });

  it("prints a real multi-step CLI report, not just help", async () => {
    const stdout: string[] = [];
    const code = await run(["demo", "--json"], {
      client: client(),
      stdout: (s) => stdout.push(s),
      stderr: (s) => { throw new Error(s); },
    });
    const report = JSON.parse(stdout.join("\n"));
    expect(code).toBe(0);
    expect(report.verified).toBe(5);
    expect(report.checks.some((e: {source: string}) => e.source.includes("Swarm"))).toBe(true);
  });

  it("rejects invalid calldata before contacting the API", async () => {
    await expect(investigate(client(), "not-hex")).rejects.toThrow("4-byte selector");
  });
});
