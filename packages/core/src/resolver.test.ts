import { describe, expect, it } from "vitest";
import { InvalidInputError, SelectorSchema, UpstreamUnavailableError } from "@atlas/schemas";

import { lookupFunction } from "./resolver.js";
import { functionRecord, memoryRepository } from "./test-fixtures.js";

describe("function lookup", () => {
  it("returns a single canonical candidate with provenance", async () => {
    const repository = memoryRepository([
      functionRecord("transfer(address,uint256)", "0xa9059cbb", "a"),
    ]);

    const result = await lookupFunction(repository, "0xA9059CBB");

    expect(result.identifier).toBe("0xa9059cbb");
    expect(result.ambiguous).toBe(false);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      signature: "transfer(address,uint256)",
      source: "OpenZeppelin/openzeppelin-contracts",
      provenance: { datasetVersion: "openzeppelin-contracts@efaa6f78ab1d-2026-11-02" },
    });
    expect(result.warnings).toEqual([]);
  });

  it("returns a valid empty result for an unknown selector", async () => {
    const result = await lookupFunction(memoryRepository([]), "0xdeadbeef");

    expect(result.candidates).toEqual([]);
    expect(result.ambiguous).toBe(false);
    expect(result.registry).toBe("arkiv-rabdi");
  });

  it("keeps every colliding candidate and marks the result ambiguous", async () => {
    const repository = memoryRepository([
      functionRecord("transfer(address,uint256)", "0xa9059cbb", "b"),
      functionRecord("many_msg_babbage(bytes1)", "0xa9059cbb", "a", "ethereum/ERCs"),
    ]);

    const result = await lookupFunction(repository, "0xa9059cbb");

    expect(result.ambiguous).toBe(true);
    expect(result.candidates.map((candidate) => candidate.signature)).toEqual([
      "many_msg_babbage(bytes1)",
      "transfer(address,uint256)",
    ]);
    expect(result.warnings[0]).toMatch(/does not rank/);
  });

  it("rejects a malformed selector before querying the registry", async () => {
    let queried = false;
    const repository = {
      ...memoryRepository([]),
      findBySelector: async () => {
        queried = true;
        return [];
      },
    };

    await expect(lookupFunction(repository, "0x1234")).rejects.toBeInstanceOf(InvalidInputError);
    await expect(lookupFunction(repository, "transfer")).rejects.toMatchObject({
      code: "INVALID_SELECTOR",
    });
    expect(queried).toBe(false);
    expect(SelectorSchema.safeParse("0x1234").success).toBe(false);
  });

  it("surfaces registry outages as upstream failures, not empty results", async () => {
    const repository = {
      ...memoryRepository([]),
      findBySelector: async () => {
        throw new Error("connection refused");
      },
    };

    const error = await lookupFunction(repository, "0xa9059cbb").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(UpstreamUnavailableError);
    expect((error as { code: string }).code).toBe("UPSTREAM_UNAVAILABLE");
  });
});
