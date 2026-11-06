import { describe, expect, it } from "vitest";
import { InvalidInputError, UpstreamUnavailableError } from "@atlas/schemas";
import { encodeFunctionData, parseAbi } from "viem";

import { decodeCalldata } from "./decode.js";
import { searchFunctions } from "./search.js";
import { functionRecord, memoryRepository } from "./test-fixtures.js";

const TRANSFER_ABI = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);
const RECIPIENT = "0x000000000000000000000000000000000000dEaD";

const transferCalldata = encodeFunctionData({
  abi: TRANSFER_ABI,
  functionName: "transfer",
  args: [RECIPIENT, 1_000_000n],
});

describe("calldata decoding", () => {
  it("decodes against the resolved signature and serializes bigints as decimal strings", async () => {
    const repository = memoryRepository([
      functionRecord("transfer(address,uint256)", "0xa9059cbb", "a"),
    ]);

    const result = await decodeCalldata(repository, transferCalldata);

    expect(result.selector).toBe("0xa9059cbb");
    expect(result.ambiguous).toBe(false);
    expect(result.decoded).toHaveLength(1);
    expect(result.decoded[0]).toMatchObject({
      signature: "transfer(address,uint256)",
      decodeStatus: "success",
      arguments: [
        { name: "arg0", type: "address", value: "0x000000000000000000000000000000000000dead" },
        { name: "arg1", type: "uint256", value: "1000000" },
      ],
    });

    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped.decoded[0].arguments[1].value).toBe("1000000");
  });

  it("reports success and failure per colliding candidate", async () => {
    const repository = memoryRepository([
      functionRecord("transfer(address,uint256)", "0xa9059cbb", "a"),
      functionRecord("many_msg_babbage(bytes1)", "0xa9059cbb", "b", "ethereum/ERCs"),
    ]);

    const result = await decodeCalldata(repository, transferCalldata);

    expect(result.ambiguous).toBe(true);
    expect(result.decoded.map((attempt) => attempt.decodeStatus)).toEqual(["success", "failed"]);
    expect(result.decoded[1]).toMatchObject({ signature: "many_msg_babbage(bytes1)" });
    expect(result.warnings).toContain(
      "Selector 0xa9059cbb has 2 canonical signatures. ATLAS does not rank them as more or less likely.",
    );
  });

  it("returns a valid empty decode for an unknown selector", async () => {
    const result = await decodeCalldata(
      memoryRepository([]),
      "0xdeadbeef0000000000000000000000000000000000000000000000000000000000000000",
    );

    expect(result.decoded).toEqual([]);
    expect(result.warnings[0]).toMatch(/No canonical signature/);
  });

  it("rejects malformed calldata", async () => {
    const repository = memoryRepository([]);

    await expect(decodeCalldata(repository, "0xzzzzzzzz")).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    await expect(decodeCalldata(repository, "0xa905")).rejects.toBeInstanceOf(InvalidInputError);
  });
});

describe("function search", () => {
  const records = [
    functionRecord("approve(address,uint256)", "0x095ea7b3", "a"),
    functionRecord("transfer(address,uint256)", "0xa9059cbb", "b"),
    functionRecord("transferFrom(address,address,uint256)", "0x23b872dd", "c"),
  ];

  it("returns canonical items with selectors and pagination", async () => {
    const result = await searchFunctions(memoryRepository(records), "transfer", { limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      signature: "transfer(address,uint256)",
      selector: "0xa9059cbb",
    });
    expect(result.pagination.nextCursor).toBe("1");

    const next = await searchFunctions(memoryRepository(records), "transfer", {
      limit: 1,
      cursor: "1",
    });
    expect(next.items[0]).toMatchObject({ signature: "transferFrom(address,address,uint256)" });
    expect(next.pagination.nextCursor).toBeNull();
  });

  it("is case-insensitive", async () => {
    const result = await searchFunctions(memoryRepository(records), "TRANSFERFROM");
    expect(result.items.map((item) => item.signature)).toEqual([
      "transferFrom(address,address,uint256)",
    ]);
  });

  it("validates query and limit", async () => {
    const repository = memoryRepository(records);

    await expect(searchFunctions(repository, "   ")).rejects.toBeInstanceOf(InvalidInputError);
    await expect(searchFunctions(repository, "a".repeat(201))).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    await expect(searchFunctions(repository, "transfer", { limit: 0 })).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    await expect(searchFunctions(repository, "transfer", { limit: 101 })).rejects.toBeInstanceOf(
      InvalidInputError,
    );
  });

  it("surfaces registry outages", async () => {
    const repository = {
      ...memoryRepository(records),
      searchBySignature: async () => {
        throw new Error("gateway timeout");
      },
    };

    await expect(searchFunctions(repository, "transfer")).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
  });
});
