import { describe, expect, it } from "vitest";
import { EventSignatureSchema, type EventSignature, type Hash } from "@atlas/schemas";
import { verifyEventRecords, writeEventRecordsInBatches } from "./event-write.js";

const event = EventSignatureSchema.parse({
  topic0: `0x${"a".repeat(64)}`,
  signature: "Transfer(address,address,uint256)",
  indexed: [true, true, false],
  source: "OpenZeppelin/openzeppelin-contracts",
  sourceId: "efaa6f78:ERC20.sol:1:Transfer(address,address,uint256)",
  importedAt: "2026-11-06T00:00:00Z",
  datasetVersion: "demo-20261106",
  recordHash: `0x${"f".repeat(64)}`,
});
function stateful() {
  const data = new Map<string, EventSignature>();
  const puts: EventSignature[] = [];
  return {
    data,
    puts,
    repository: {
      findByRecordHash: async (hash: Hash) => (data.has(hash) ? [data.get(hash)] : []),
      put: async (item: EventSignature) => {
        puts.push(item);
        data.set(item.recordHash, item);
        return { entityKey: `0x${"b".repeat(64)}`, txHash: `0x${"c".repeat(64)}` };
      },
    },
  };
}

describe("approved event-write pipeline", () => {
  it("writes a record and verifies its event topic and indexed layout", async () => {
    const { repository, puts } = stateful();
    const result = await writeEventRecordsInBatches([event], repository, { batchSize: 1 });
    expect(result.written).toHaveLength(1);
    expect(result.failures).toEqual([]);
    expect(puts).toHaveLength(1);
    expect(await verifyEventRecords([event], repository)).toEqual({
      verified: 1,
      missing: [],
      mismatched: [],
    });
  });

  it("skips existing hashes and never duplicates a record", async () => {
    const { repository, puts } = stateful();
    await repository.put(event);
    puts.length = 0;
    const result = await writeEventRecordsInBatches([event], repository);
    expect(result.skipped).toBe(1);
    expect(puts).toHaveLength(0);
  });

  it("reports a failed transaction without retrying", async () => {
    let calls = 0;
    const repository = {
      findByRecordHash: async () => [],
      put: async () => {
        calls += 1;
        throw new Error("receipt uncertain");
      },
    };
    const result = await writeEventRecordsInBatches([event], repository);
    expect(calls).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.reason).toBe("receipt uncertain");
  });

  it("detects missing or modified on-chain event payloads", async () => {
    const repository = {
      findByRecordHash: async () => [
        { ...event, indexed: [false, false, false] },
      ],
    };
    const result = await verifyEventRecords([event], repository);
    expect(result.verified).toBe(0);
    expect(result.mismatched).toEqual([event.recordHash]);
  });
});
