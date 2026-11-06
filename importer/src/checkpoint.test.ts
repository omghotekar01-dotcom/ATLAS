import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  assertBatchSize,
  CheckpointMismatchError,
  ImportCheckpoint,
  parseCheckpoint,
  type CheckpointIdentity,
} from "./checkpoint.js";

const identity: CheckpointIdentity = {
  datasetVersion: "openzeppelin-contracts@efaa6f78ab1d-2026-11-06",
  sourceId: "openzeppelin-contracts",
  commitSha: "efaa6f78ab1dde05416246e801c0baaf4f900d49",
  treeDigest: `0x${"a".repeat(64)}`,
  batchSize: 25,
  totalRecords: 4,
};

const directories: string[] = [];

async function temporaryCheckpoint(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "atlas-checkpoint-"));
  directories.push(directory);
  return path.join(directory, "state.json");
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("import checkpoints", () => {
  it("persists progress after a batch and reloads it", async () => {
    const file = await temporaryCheckpoint();
    const checkpoint = await ImportCheckpoint.create(file, identity);
    checkpoint.markWritten(`0x${"1".repeat(64)}`);
    checkpoint.markSkipped(`0x${"2".repeat(64)}`);
    await checkpoint.commitBatch();

    const loaded = await ImportCheckpoint.load(file, identity);
    expect(loaded.completedCount).toBe(2);
    expect(loaded.has(`0x${"1".repeat(64)}`)).toBe(true);
    expect(loaded.has(`0x${"2".repeat(64)}`)).toBe(true);
    expect(loaded.batchesCompleted).toBe(1);
    expect(loaded.toJSON().status).toBe("in-progress");

    await loaded.complete();
    const completed = await ImportCheckpoint.load(file, identity);
    expect(completed.toJSON().status).toBe("completed");
    expect(JSON.parse(await readFile(file, "utf8")).version).toBe(1);
  });

  it("refuses a checkpoint from a different snapshot or dataset", async () => {
    const file = await temporaryCheckpoint();
    await ImportCheckpoint.create(file, identity);

    await expect(
      ImportCheckpoint.load(file, { ...identity, treeDigest: `0x${"b".repeat(64)}` }),
    ).rejects.toBeInstanceOf(CheckpointMismatchError);
    await expect(
      ImportCheckpoint.load(file, { ...identity, datasetVersion: "another-dataset" }),
    ).rejects.toBeInstanceOf(CheckpointMismatchError);
    await expect(
      ImportCheckpoint.load(file, { ...identity, batchSize: 10 }),
    ).rejects.toBeInstanceOf(CheckpointMismatchError);
  });

  it("rejects corrupt or unsupported checkpoint files", async () => {
    const file = await temporaryCheckpoint();
    await writeFile(file, "{not json", "utf8");
    await expect(ImportCheckpoint.load(file, identity)).rejects.toThrow();

    await writeFile(file, JSON.stringify({ version: 99 }), "utf8");
    await expect(ImportCheckpoint.load(file, identity)).rejects.toThrow("Unsupported checkpoint");
  });

  it("validates checkpoint shape and batch bounds", () => {
    expect(() => assertBatchSize(0)).toThrow("1 to 100");
    expect(() => assertBatchSize(101)).toThrow("1 to 100");
    expect(assertBatchSize(100)).toBe(100);
    expect(() => parseCheckpoint({ version: 1, datasetVersion: "x" }, identity)).toThrow(
      "incomplete",
    );
  });
});
