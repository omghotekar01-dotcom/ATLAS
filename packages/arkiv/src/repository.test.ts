import { describe, expect, it } from "vitest";
import type { PublicArkivClient } from "@arkiv-network/sdk";
import type { Address, Hex } from "viem";
import { ArkivFunctionRepository, parseStoredFunctionSignature } from "./repository.js";

const creator = "0x0000000000000000000000000000000000000001" as Address;
const otherCreator = "0x0000000000000000000000000000000000000002" as Address;
const recordHash = `0x${"a".repeat(64)}`;
const storedEntity = {
  $key: `0x${"b".repeat(64)}` as Hex,
  $creator: creator,
  selector: { value: "0x12345678" },
  signature: { value: "0x6578616d706c652829" as Hex },
  source: { value: "4byte.directory" },
  sourceId: { value: "123" },
  importedAt: { value: "2026-01-01T00:00:00Z" },
  datasetVersion: { value: "1" },
  recordHash: { value: recordHash },
};

describe("parseStoredFunctionSignature", () => {
  it("decodes UTF-8 bytes and attaches trusted Arkiv provenance", () => {
    expect(parseStoredFunctionSignature(storedEntity, creator)).toEqual({
      selector: "0x12345678",
      signature: "example()",
      source: "4byte.directory",
      sourceId: "123",
      importedAt: "2026-01-01T00:00:00Z",
      datasetVersion: "1",
      recordHash,
      entityKey: storedEntity.$key,
      creator,
    });
  });

  it("rejects entities created by a different account", () => {
    expect(() => parseStoredFunctionSignature(storedEntity, otherCreator)).toThrow(
      "unexpected creator",
    );
  });

  it("rejects malformed indexed fields after decoding", () => {
    expect(() =>
      parseStoredFunctionSignature({ ...storedEntity, selector: { value: "0x1234" } }, creator),
    ).toThrow();
  });
});

function entity(index: number, key = index): ArkivFunctionEntityFixture {
  const hex = (value: number) => value.toString(16).padStart(64, "0");
  return {
    $key: `0x${hex(key)}` as Hex,
    $creator: creator,
    selector: { value: "0x12345678" },
    signature: { value: "0x6578616d706c652829" as Hex },
    source: { value: "OpenZeppelin/openzeppelin-contracts" },
    sourceId: { value: `record-${index}` },
    importedAt: { value: "2026-01-01T00:00:00Z" },
    datasetVersion: { value: "snapshot-1" },
    recordHash: { value: `0x${hex(index + 1)}` },
  };
}

type ArkivFunctionEntityFixture = Parameters<typeof parseStoredFunctionSignature>[0];

function fakeClient(pages: ArkivFunctionEntityFixture[][]) {
  let page = 0;
  const whereCalls: unknown[] = [];
  const builder = {
    from() {
      return this;
    },
    createdBy() {
      return this;
    },
    where(expression: unknown) {
      whereCalls.push(expression);
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

  const client = { select: () => builder } as unknown as PublicArkivClient;
  return { client, whereCalls };
}

describe("ArkivFunctionRepository", () => {
  it("finds records by content hash and verifies the creator", async () => {
    const { client } = fakeClient([[entity(1)]]);
    const repository = new ArkivFunctionRepository(client, creator);

    const records = await repository.findByRecordHash(
      `0x${"0".repeat(62)}02` as Parameters<typeof repository.findByRecordHash>[0],
    );

    expect(records).toHaveLength(1);
    expect(records[0]?.creator).toBe(creator);
    expect(records[0]?.sourceId).toBe("record-1");
  });

  it("rejects a record whose creator does not match the trusted creator", async () => {
    const { client } = fakeClient([[{ ...entity(1), $creator: otherCreator }]]);
    const repository = new ArkivFunctionRepository(client, creator);

    await expect(
      repository.findBySelector("0x12345678" as Parameters<typeof repository.findBySelector>[0]),
    ).rejects.toThrow("unexpected creator");
  });

  it("advances with a key-based cursor across pages", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => entity(index));
    const { client, whereCalls } = fakeClient([firstPage, [entity(100)]]);
    const repository = new ArkivFunctionRepository(client, creator);

    const records = await repository.findBySelector(
      "0x12345678" as Parameters<typeof repository.findBySelector>[0],
    );

    expect(records).toHaveLength(101);
    expect(whereCalls).toHaveLength(3);
  });

  it("fails instead of looping when the cursor does not advance", async () => {
    const stuckPage = Array.from({ length: 100 }, (_, index) => entity(index, 7));
    const { client } = fakeClient([stuckPage, stuckPage]);
    const repository = new ArkivFunctionRepository(client, creator);

    await expect(
      repository.findBySelector("0x12345678" as Parameters<typeof repository.findBySelector>[0]),
    ).rejects.toThrow("did not advance");
  });
});

describe("ArkivFunctionRepository.searchBySignature", () => {
  function signed(index: number, signature: string, selector: string) {
    return {
      ...entity(index),
      selector: { value: selector },
      signature: { value: `0x${Buffer.from(signature).toString("hex")}` as Hex },
    };
  }

  it("filters by literal signature text and paginates deterministically", async () => {
    const makeRepository = () =>
      new ArkivFunctionRepository(
        fakeClient([
          [
            signed(1, "approve(address,uint256)", "0x095ea7b3"),
            signed(2, "transfer(address,uint256)", "0xa9059cbb"),
            signed(3, "transferFrom(address,address,uint256)", "0x23b872dd"),
          ],
        ]).client,
        creator,
      );

    const first = await makeRepository().searchBySignature("transfer", { limit: 1 });
    expect(first.items.map((record) => record.signature)).toEqual(["transfer(address,uint256)"]);
    expect(first.nextCursor).toBe("1");

    const second = await makeRepository().searchBySignature("transfer", {
      limit: 5,
      cursor: first.nextCursor!,
    });
    expect(second.items.map((record) => record.signature)).toEqual([
      "transferFrom(address,address,uint256)",
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it("rejects an empty query and a malformed cursor", async () => {
    const { client } = fakeClient([[]]);
    const repository = new ArkivFunctionRepository(client, creator);

    await expect(repository.searchBySignature("  ", { limit: 5 })).rejects.toThrow(
      "query is required",
    );
    await expect(
      repository.searchBySignature("transfer", { limit: 5, cursor: "-1" }),
    ).rejects.toThrow("non-negative integer");
  });

  it("verifies the creator during a scan", async () => {
    const { client } = fakeClient([
      [{ ...signed(1, "transfer(address,uint256)", "0xa9059cbb"), $creator: otherCreator }],
    ]);
    const repository = new ArkivFunctionRepository(client, creator);

    await expect(repository.searchBySignature("transfer", { limit: 5 })).rejects.toThrow(
      "unexpected creator",
    );
  });
});
