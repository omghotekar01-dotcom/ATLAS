import { describe, expect, it } from "vitest";
import type { PublicArkivClient, WalletArkivClient } from "@arkiv-network/sdk";
import type { Address, Hex } from "viem";
import { toEventSelector } from "viem";
import {
  ArkivEventRepository,
  decodeIndexedLayout,
  encodeIndexedLayout,
  parseStoredEventSignature,
  toEventSchemaValues,
} from "./event-repository.js";

const creator = "0x0000000000000000000000000000000000000001" as Address;
const otherCreator = "0x0000000000000000000000000000000000000002" as Address;
const signature = "Transfer(address,address,uint256)";
const topic0 = toEventSelector(signature);

function entity(seed = 1) {
  const hex = (value: number) => value.toString(16).padStart(64, "0");
  return {
    $key: `0x${hex(seed)}` as Hex,
    $creator: creator,
    topic0: { value: topic0 },
    signature: { value: `0x${Buffer.from(signature).toString("hex")}` as Hex },
    indexed: { value: "1,1,0" },
    source: { value: "OpenZeppelin/openzeppelin-contracts" },
    sourceId: { value: `efaa6f78ab1d:${signature}` },
    importedAt: { value: "2026-11-06T00:00:00.000Z" },
    datasetVersion: { value: "openzeppelin-contracts@efaa6f78ab1d-2026-11-02" },
    recordHash: { value: `0x${hex(seed + 1)}` },
  };
}

function fakeClient(pages: ReturnType<typeof entity>[][]) {
  return {
    select() {
      let page = 0;
      return {
        from() {
          return this;
        },
        createdBy() {
          return this;
        },
        where() {
          return this;
        },
        orderBy() {
          return this;
        },
        limit() {
          return this;
        },
        async fetch() {
          const entities = pages[page] ?? [];
          page += 1;
          return { entities, blockNumber: 0n, skipped: 0, count: undefined };
        },
      };
    },
  } as unknown as PublicArkivClient;
}

describe("event layout encoding", () => {
  it("round-trips indexed layouts and preserves an absent layout", () => {
    expect(encodeIndexedLayout([true, false, true])).toBe("1,0,1");
    expect(decodeIndexedLayout("1,0,1")).toEqual([true, false, true]);
    expect(decodeIndexedLayout(undefined)).toBeUndefined();
    expect(() => decodeIndexedLayout("1,x")).toThrow("Invalid indexed layout");
  });
});

describe("parseStoredEventSignature", () => {
  it("decodes UTF-8, indexed layout and trusted provenance", () => {
    expect(parseStoredEventSignature(entity(), creator)).toMatchObject({
      topic0,
      signature,
      indexed: [true, true, false],
      creator,
    });
  });

  it("rejects a different creator", () => {
    expect(() => parseStoredEventSignature(entity(), otherCreator)).toThrow("unexpected creator");
  });
});

describe("ArkivEventRepository", () => {
  it("returns canonical events for a topic0", async () => {
    const repository = new ArkivEventRepository(fakeClient([[entity()]]), creator);
    const records = await repository.findByTopic0(topic0 as never);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ signature, indexed: [true, true, false] });
  });

  it("fails instead of looping when pagination stalls", async () => {
    const page = Array.from({ length: 100 }, (_, index) => entity(index));
    const repository = new ArkivEventRepository(fakeClient([page, page]), creator);

    await expect(repository.findByTopic0(topic0 as never)).rejects.toThrow("did not advance");
  });

  it("resolves an event by content hash for idempotent importing", async () => {
    const repository = new ArkivEventRepository(fakeClient([[entity()]]), creator);
    const result = await repository.findByRecordHash(`0x${"0".repeat(63)}2` as never);
    expect(result).toHaveLength(1);
    expect(result[0]?.topic0).toBe(topic0);
  });

  it("requires the trusted creator's wallet before writing", async () => {
    const record = parseStoredEventSignature(entity(), creator);
    const readOnly = new ArkivEventRepository(fakeClient([]), creator);
    await expect(readOnly.put(record)).rejects.toThrow("wallet client");

    const foreignWallet = {
      account: { address: otherCreator },
    } as unknown as WalletArkivClient;
    const mismatched = new ArkivEventRepository(fakeClient([]), creator, foreignWallet);
    await expect(mismatched.put(record)).rejects.toThrow("trusted creator");
  });

  it("sends canonical event schema values through a matching wallet", async () => {
    const record = parseStoredEventSignature(entity(), creator);
    const calls: unknown[] = [];
    const wallet = {
      account: { address: creator },
      createEntity: async (...args: unknown[]) => {
        calls.push(args);
        return {
          entityKey: `0x${"e".repeat(64)}`,
          txHash: `0x${"f".repeat(64)}`,
        };
      },
    } as unknown as WalletArkivClient;
    const repository = new ArkivEventRepository(fakeClient([]), creator, wallet);
    const written = await repository.put(record);
    expect(written.txHash).toBe(`0x${"f".repeat(64)}`);
    const values = (calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(values.topic0).toBe(topic0);
    expect(values.indexed).toBe("1,1,0");
  });

  it("builds schema values for a future importer write", () => {
    const values = toEventSchemaValues({
      topic0: topic0 as never,
      signature,
      indexed: [true, true, false],
      source: "ethereum/ERCs",
      sourceId: "7dafd1125ffb:ERC20.sol:12:Transfer",
      importedAt: "2026-11-06T00:00:00.000Z" as never,
      datasetVersion: "ethereum-ercs@7dafd1125ffb-2026-11-04",
      recordHash: `0x${"a".repeat(64)}` as never,
    });

    expect(values).toMatchObject({ topic0, indexed: "1,1,0" });
  });
});
