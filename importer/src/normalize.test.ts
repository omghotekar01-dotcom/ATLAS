import { describe, expect, it } from "vitest";

import { buildRecords, canonicalSignature } from "./normalize.js";
import type { EventDraft, FunctionDraft } from "./solidity.js";

const importedAt = "2026-11-06T00:00:00.000Z";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function functionDraft(overrides: Partial<FunctionDraft> = {}): FunctionDraft {
  return {
    kind: "function",
    selector: "0xa9059cbb",
    signature: "transfer(address,uint256)",
    source: "OpenZeppelin/openzeppelin-contracts",
    sourceId: "commit:Example.sol:4:transfer(address,uint256)",
    ...overrides,
  };
}

function eventDraft(overrides: Partial<EventDraft> = {}): EventDraft {
  return {
    kind: "event",
    topic0: TRANSFER_TOPIC,
    signature: "Transfer(address,address,uint256)",
    source: "OpenZeppelin/openzeppelin-contracts",
    sourceId: "commit:Example.sol:10:Transfer(address,address,uint256)",
    ...overrides,
  };
}

describe("record normalization", () => {
  it("collapses identical declarations to the smallest source ID", async () => {
    const records = await buildRecords(
      {
        functions: [
          functionDraft({ sourceId: "commit:nested/Duplicate.sol:9:transfer(address,uint256)" }),
          functionDraft({ sourceId: "commit:Example.sol:4:transfer(address,uint256)" }),
        ],
        events: [eventDraft()],
      },
      { datasetVersion: "snapshot-1", importedAt },
    );

    expect(records.duplicates).toBe(1);
    expect(records.functions).toHaveLength(1);
    expect(records.functions[0]?.sourceId).toBe("commit:Example.sol:4:transfer(address,uint256)");
    expect(records.functions[0]?.recordHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("never collapses distinct signatures that share a selector", async () => {
    const records = await buildRecords(
      {
        functions: [
          functionDraft(),
          functionDraft({
            signature: "many_msg_babbage(bytes1)",
            sourceId: "commit:Example.sol:5:many_msg_babbage(bytes1)",
          }),
        ],
        events: [],
      },
      { datasetVersion: "snapshot-1", importedAt },
    );

    expect(records.functions).toHaveLength(2);
    expect(new Set(records.functions.map((record) => record.selector)).size).toBe(1);
    expect(new Set(records.functions.map((record) => record.recordHash)).size).toBe(2);
  });

  it("keeps every overload of one function name", async () => {
    const records = await buildRecords(
      {
        functions: [
          functionDraft({
            selector: "0x42842e0e",
            signature: "safeTransferFrom(address,address,uint256)",
          }),
          functionDraft({
            selector: "0xb88d4fde",
            signature: "safeTransferFrom(address,address,uint256,bytes)",
            sourceId: "commit:Example.sol:6:safeTransferFrom(address,address,uint256,bytes)",
          }),
        ],
        events: [],
      },
      { datasetVersion: "snapshot-1", importedAt },
    );

    expect(records.functions).toHaveLength(2);
    expect(new Set(records.functions.map((record) => record.selector)).size).toBe(2);
  });

  it("rejects a selector that does not match the supplied signature", async () => {
    const records = await buildRecords(
      { functions: [functionDraft({ selector: "0x095ea7b3" })], events: [] },
      { datasetVersion: "snapshot-1", importedAt },
    );

    expect(records.functions).toEqual([]);
    expect(records.rejections).toHaveLength(1);
    expect(records.rejections[0]?.reason).toContain("selector mismatch");
    expect(records.rejections[0]?.reason).toContain("0xa9059cbb");
  });

  it("rejects a topic0 that does not match the supplied event signature", async () => {
    const records = await buildRecords(
      { functions: [], events: [eventDraft({ topic0: `0x${"1".repeat(64)}` })] },
      { datasetVersion: "snapshot-1", importedAt },
    );

    expect(records.events).toEqual([]);
    expect(records.rejections[0]?.reason).toContain("topic0 mismatch");
  });

  it("rejects malformed signatures instead of inventing a selector", async () => {
    const records = await buildRecords(
      {
        functions: [functionDraft({ signature: "transfer(address" })],
        events: [eventDraft({ signature: "Transfer(address,,uint256)" })],
      },
      { datasetVersion: "snapshot-1", importedAt },
    );

    expect(records.functions).toEqual([]);
    expect(records.events).toEqual([]);
    expect(records.rejections.map((entry) => entry.reason).join("\n")).toContain("invalid ABI");
  });

  it("canonicalizes whitespace before hashing the same signature", async () => {
    const padded = await buildRecords(
      {
        functions: [functionDraft({ signature: "transfer(address, uint256)" })],
        events: [],
      },
      { datasetVersion: "snapshot-1", importedAt },
    );
    const canonical = await buildRecords(
      { functions: [functionDraft()], events: [] },
      { datasetVersion: "snapshot-1", importedAt },
    );

    expect(padded.functions[0]?.signature).toBe("transfer(address,uint256)");
    expect(padded.functions[0]?.recordHash).toBe(canonical.functions[0]?.recordHash);
  });

  it("excludes import metadata and snapshot versions from the content hash", async () => {
    const drafts = { functions: [functionDraft()], events: [eventDraft()] };
    const first = await buildRecords(drafts, { datasetVersion: "snapshot-1", importedAt });
    const second = await buildRecords(drafts, {
      datasetVersion: "snapshot-2",
      importedAt: "2027-01-01T00:00:00.000Z",
    });

    expect(second.functions[0]?.recordHash).toBe(first.functions[0]?.recordHash);
    expect(second.events[0]?.recordHash).toBe(first.events[0]?.recordHash);
    expect(second.functions[0]?.datasetVersion).toBe("snapshot-2");
    expect(first.functions[0]?.signature).toBe("transfer(address,uint256)");
  });

  it("sorts records deterministically by content hash", async () => {
    const records = await buildRecords(
      {
        functions: [
          functionDraft(),
          functionDraft({
            selector: "0x095ea7b3",
            signature: "approve(address,uint256)",
            sourceId: "commit:Example.sol:6:approve(address,uint256)",
          }),
        ],
        events: [],
      },
      { datasetVersion: "snapshot-1", importedAt },
    );

    const hashes = records.functions.map((record) => record.recordHash);
    expect(hashes).toEqual([...hashes].sort((left, right) => left.localeCompare(right)));
  });
});

describe("canonicalSignature", () => {
  it("returns viem-computed identifiers for canonical input", () => {
    expect(canonicalSignature("function transfer(address,uint256)", "function")).toEqual({
      ok: true,
      signature: "transfer(address,uint256)",
      identifier: "0xa9059cbb",
    });
    expect(canonicalSignature("Transfer(address,address,uint256)", "event")).toEqual({
      ok: true,
      signature: "Transfer(address,address,uint256)",
      identifier: TRANSFER_TOPIC,
    });
  });

  it("rejects empty, prefixed-only and non-identifier signatures", () => {
    expect(canonicalSignature("", "function")).toMatchObject({ ok: false });
    expect(canonicalSignature("function", "function")).toMatchObject({ ok: false });
    expect(canonicalSignature("1transfer(uint256)", "function")).toMatchObject({ ok: false });
  });
});
