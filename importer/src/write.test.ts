import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FunctionSignatureSchema, type FunctionSignature, type Hash } from "@atlas/schemas";

import { ImportCheckpoint, type CheckpointIdentity } from "./checkpoint.js";
import {
  verifyFunctionRecords,
  writeFunctionRecords,
  writeFunctionRecordsInBatches,
} from "./write.js";

const importedAt = "2026-11-06T00:00:00.000Z";

function record(signature: string, selector: string, hash: string): FunctionSignature {
  return FunctionSignatureSchema.parse({
    selector,
    signature,
    source: "OpenZeppelin/openzeppelin-contracts",
    sourceId: `commit:Example.sol:${signature}`,
    importedAt,
    datasetVersion: "snapshot-1",
    recordHash: `0x${hash.repeat(64)}`,
  });
}

const transfer = record("transfer(address,uint256)", "0xa9059cbb", "a");
const approve = record("approve(address,uint256)", "0x095ea7b3", "b");

interface FakeRepository {
  findByRecordHash(recordHash: Hash): Promise<readonly unknown[]>;
  put(input: FunctionSignature): Promise<{ entityKey: string; txHash: string }>;
}

function fakeRepository(options: { existing?: Set<string>; failOn?: string } = {}) {
  const puts: FunctionSignature[] = [];
  const lookups: string[] = [];
  const repository: FakeRepository = {
    findByRecordHash: async (recordHash) => {
      lookups.push(recordHash);
      return options.existing?.has(recordHash) ? [{ signature: "existing" }] : [];
    },
    put: async (input) => {
      if (options.failOn === input.signature) throw new Error("write rejected");
      puts.push(input);
      return { entityKey: `0x${"e".repeat(64)}`, txHash: `0x${"f".repeat(64)}` };
    },
  };
  return { repository, puts, lookups };
}

describe("idempotent function writes", () => {
  it("writes only records whose content hash is absent", async () => {
    const { repository, puts } = fakeRepository({
      existing: new Set([transfer.recordHash]),
    });

    const result = await writeFunctionRecords([transfer, approve], repository, { eventCount: 2 });

    expect(puts.map((entry) => entry.signature)).toEqual(["approve(address,uint256)"]);
    expect(result.written).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.failures).toEqual([]);
    expect(result.deferredEvents).toBe(2);
  });

  it("records a failure once and never retries it", async () => {
    const { repository, lookups } = fakeRepository({ failOn: "transfer(address,uint256)" });

    const result = await writeFunctionRecords([transfer], repository);

    expect(result.written).toEqual([]);
    expect(result.failures).toEqual([
      {
        recordHash: transfer.recordHash,
        signature: "transfer(address,uint256)",
        reason: "write rejected",
      },
    ]);
    expect(lookups).toHaveLength(1);
  });

  it("verifies read-back content instead of assuming success", async () => {
    const { repository } = fakeRepository();
    const stored = [{ ...transfer, entityKey: `0x${"e".repeat(64)}` }];
    const verifier = {
      findByRecordHash: async (recordHash: Hash) =>
        recordHash === transfer.recordHash
          ? stored
          : recordHash === approve.recordHash
            ? [{ ...approve, signature: "changed(address,uint256)" }]
            : [],
    };

    const result = await verifyFunctionRecords([transfer, approve], verifier);

    expect(result.verified).toBe(1);
    expect(result.mismatched).toEqual([approve.recordHash]);
    expect(result.missing).toEqual([]);
    expect(repository).toBeDefined();
  });

  it("reports records that are missing after a write", async () => {
    const result = await verifyFunctionRecords([transfer], fakeRepository().repository);

    expect(result.verified).toBe(0);
    expect(result.missing).toEqual([transfer.recordHash]);
  });
});

const importedAt2 = "2026-11-06T00:00:00.000Z";

function hashed(signature: string, selector: string, hash: string): FunctionSignature {
  return FunctionSignatureSchema.parse({
    selector,
    signature,
    source: "OpenZeppelin/openzeppelin-contracts",
    sourceId: `commit:Example.sol:1:${signature}`,
    importedAt: importedAt2,
    datasetVersion: "snapshot-1",
    recordHash: `0x${hash.repeat(64)}`,
  });
}

const records = [
  hashed("approve(address,uint256)", "0x095ea7b3", "a"),
  hashed("balanceOf(address)", "0x70a08231", "b"),
  hashed("deposit()", "0xd0e30db0", "c"),
  hashed("transfer(address,uint256)", "0xa9059cbb", "d"),
];

const identity: CheckpointIdentity = {
  datasetVersion: "snapshot-1",
  sourceId: "openzeppelin-contracts",
  commitSha: "efaa6f78ab1dde05416246e801c0baaf4f900d49",
  treeDigest: `0x${"e".repeat(64)}`,
  batchSize: 2,
  totalRecords: records.length,
};

function statefulRepository() {
  const stored = new Map<string, readonly unknown[]>();
  const puts: FunctionSignature[] = [];
  return {
    repository: {
      findByRecordHash: async (recordHash: Hash) => stored.get(recordHash) ?? [],
      put: async (input: FunctionSignature) => {
        stored.set(input.recordHash, [input]);
        puts.push(input);
        return {
          entityKey: `0x${input.recordHash.slice(2, 10)}`,
          txHash: `0x${"f".repeat(64)}`,
        };
      },
    },
    puts,
  };
}

const directories: string[] = [];

async function checkpointFile(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "atlas-batch-"));
  directories.push(directory);
  return path.join(directory, "checkpoint.json");
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("batched, resumable writes", () => {
  it("writes in bounded batches and reports progress", async () => {
    const { repository } = statefulRepository();
    const progress: number[] = [];

    const result = await writeFunctionRecordsInBatches(records, repository, {
      batchSize: 2,
      onBatch: (batch) => progress.push(batch.written),
    });

    expect(result.batches).toBe(2);
    expect(result.written).toHaveLength(4);
    expect(progress).toEqual([2, 4]);
  });

  it("caps a trial run with maxRecords and reports deferred work", async () => {
    const { repository, puts } = statefulRepository();

    const result = await writeFunctionRecordsInBatches(records, repository, {
      batchSize: 2,
      maxRecords: 2,
    });

    expect(puts).toHaveLength(2);
    expect(result.deferred).toBe(2);
    expect(result.deferredEvents).toBe(0);
  });

  it("resumes an interrupted import without duplicate writes", async () => {
    const file = await checkpointFile();
    const checkpoint = await ImportCheckpoint.create(file, identity);
    const { repository, puts } = statefulRepository();

    await expect(
      writeFunctionRecordsInBatches(records, repository, {
        batchSize: 2,
        checkpoint,
        onBatch: (batch) => {
          if (batch.batch === 1) throw new Error("process interrupted");
        },
      }),
    ).rejects.toThrow("process interrupted");

    const persisted = await ImportCheckpoint.load(file, identity);
    expect(persisted.completedCount).toBe(2);
    expect(puts).toHaveLength(2);

    const resumed = await writeFunctionRecordsInBatches(records, repository, {
      batchSize: 2,
      checkpoint: persisted,
    });

    expect(resumed.resumed).toBe(2);
    expect(resumed.written).toHaveLength(2);
    expect(puts).toHaveLength(4);
    expect(new Set(puts.map((record) => record.recordHash)).size).toBe(4);
    await expect(
      writeFunctionRecordsInBatches(records, repository, {
        batchSize: 2,
        checkpoint: persisted,
      }),
    ).resolves.toMatchObject({ written: [], skipped: 0, resumed: 4 });
  });

  it("records an existing entity as skipped and checkpoints it", async () => {
    const file = await checkpointFile();
    const checkpoint = await ImportCheckpoint.create(file, identity);
    const { repository, puts } = statefulRepository();
    await repository.put(records[0]!);
    puts.length = 0;

    const result = await writeFunctionRecordsInBatches([records[0]!], repository, {
      batchSize: 1,
      checkpoint,
    });

    expect(result.skipped).toBe(1);
    expect(result.written).toEqual([]);
    expect(puts).toHaveLength(0);
    expect(checkpoint.has(records[0]!.recordHash)).toBe(true);
  });
});
