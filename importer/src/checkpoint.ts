/**
 * Versioned, atomic import checkpoints.
 *
 * A checkpoint is an optimisation and an audit trail, not the correctness
 * mechanism: every resumed record is still checked against Arkiv by content
 * hash. A checkpoint is only valid for the exact snapshot, dataset version and
 * batch size recorded in it, so a different source cannot silently inherit
 * completed state.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const CHECKPOINT_VERSION = 1;
export const DEFAULT_BATCH_SIZE = 25;
export const MAX_BATCH_SIZE = 100;

export interface CheckpointIdentity {
  readonly datasetVersion: string;
  readonly sourceId: string;
  readonly commitSha: string;
  readonly treeDigest: string;
  readonly batchSize: number;
  readonly totalRecords: number;
}

export interface CheckpointFailure {
  readonly recordHash: string;
  readonly signature: string;
  readonly reason: string;
}

export interface CheckpointState extends CheckpointIdentity {
  readonly version: number;
  readonly createdAt: string;
  updatedAt: string;
  status: "in-progress" | "completed";
  batchesCompleted: number;
  written: string[];
  skipped: string[];
  failed: CheckpointFailure[];
}

export class CheckpointMismatchError extends Error {}

export function assertBatchSize(size: number): number {
  if (!Number.isInteger(size) || size < 1 || size > MAX_BATCH_SIZE) {
    throw new Error(`Batch size must be an integer from 1 to ${MAX_BATCH_SIZE}, received ${size}.`);
  }
  return size;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function parseCheckpoint(raw: unknown, identity: CheckpointIdentity): CheckpointState {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Checkpoint contents are not an object.");
  }
  const state = raw as Partial<CheckpointState>;
  if (state.version !== CHECKPOINT_VERSION) {
    throw new Error(
      `Unsupported checkpoint version ${String(state.version)}; expected ${CHECKPOINT_VERSION}.`,
    );
  }
  if (
    typeof state.datasetVersion !== "string" ||
    typeof state.sourceId !== "string" ||
    typeof state.commitSha !== "string" ||
    typeof state.treeDigest !== "string" ||
    typeof state.batchSize !== "number" ||
    typeof state.totalRecords !== "number" ||
    typeof state.createdAt !== "string" ||
    typeof state.updatedAt !== "string" ||
    (state.status !== "in-progress" && state.status !== "completed") ||
    !isStringArray(state.written) ||
    !isStringArray(state.skipped) ||
    !Array.isArray(state.failed)
  ) {
    throw new Error("Checkpoint is incomplete or malformed.");
  }

  const recorded = state as CheckpointState;
  const mismatch =
    recorded.datasetVersion !== identity.datasetVersion ||
    recorded.sourceId !== identity.sourceId ||
    recorded.commitSha !== identity.commitSha ||
    recorded.treeDigest !== identity.treeDigest ||
    recorded.batchSize !== identity.batchSize ||
    recorded.totalRecords !== identity.totalRecords;

  if (mismatch) {
    throw new CheckpointMismatchError(
      `Checkpoint belongs to a different import (dataset ${recorded.datasetVersion}, ${recorded.sourceId}@${recorded.commitSha.slice(0, 12)}, tree ${recorded.treeDigest.slice(0, 10)}…, batch ${recorded.batchSize}, ${recorded.totalRecords} records). Use --fresh or a new --checkpoint path.`,
    );
  }

  return recorded;
}

export class ImportCheckpoint {
  private readonly writtenHashes: Set<string>;
  private readonly skippedHashes: Set<string>;
  private readonly state: CheckpointState;

  private constructor(
    private readonly filePath: string,
    state: CheckpointState,
  ) {
    this.state = state;
    this.writtenHashes = new Set(state.written);
    this.skippedHashes = new Set(state.skipped);
  }

  static async create(
    filePath: string,
    identity: CheckpointIdentity,
    now = new Date(),
  ): Promise<ImportCheckpoint> {
    assertBatchSize(identity.batchSize);
    const timestamp = now.toISOString();
    const state: CheckpointState = {
      version: CHECKPOINT_VERSION,
      ...identity,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: "in-progress",
      batchesCompleted: 0,
      written: [],
      skipped: [],
      failed: [],
    };
    const checkpoint = new ImportCheckpoint(filePath, state);
    await checkpoint.persist();
    return checkpoint;
  }

  static async load(filePath: string, identity: CheckpointIdentity): Promise<ImportCheckpoint> {
    const raw: unknown = JSON.parse(await readFile(filePath, "utf8"));
    return new ImportCheckpoint(filePath, parseCheckpoint(raw, identity));
  }

  static async openOrCreate(
    filePath: string,
    identity: CheckpointIdentity,
    options: { resume?: boolean; now?: Date } = {},
  ): Promise<{ checkpoint: ImportCheckpoint; resumed: boolean }> {
    if (options.resume) {
      return { checkpoint: await ImportCheckpoint.load(filePath, identity), resumed: true };
    }
    return {
      checkpoint: await ImportCheckpoint.create(filePath, identity, options.now),
      resumed: false,
    };
  }

  has(recordHash: string): boolean {
    return this.writtenHashes.has(recordHash) || this.skippedHashes.has(recordHash);
  }

  get completedCount(): number {
    return this.writtenHashes.size + this.skippedHashes.size;
  }

  get batchesCompleted(): number {
    return this.state.batchesCompleted;
  }

  get failures(): readonly CheckpointFailure[] {
    return this.state.failed;
  }

  markWritten(recordHash: string): void {
    this.writtenHashes.add(recordHash);
  }

  markSkipped(recordHash: string): void {
    this.skippedHashes.add(recordHash);
  }

  markFailed(failure: CheckpointFailure): void {
    this.state.failed.push(failure);
  }

  /** Persists progress after a batch. Safe to call repeatedly. */
  async commitBatch(now = new Date()): Promise<void> {
    this.state.batchesCompleted += 1;
    this.state.written = [...this.writtenHashes].sort();
    this.state.skipped = [...this.skippedHashes].sort();
    this.state.updatedAt = now.toISOString();
    await this.persist();
  }

  async complete(now = new Date()): Promise<void> {
    this.state.status = "completed";
    this.state.written = [...this.writtenHashes].sort();
    this.state.skipped = [...this.skippedHashes].sort();
    this.state.updatedAt = now.toISOString();
    await this.persist();
  }

  toJSON(): CheckpointState {
    return {
      ...this.state,
      written: [...this.writtenHashes].sort(),
      skipped: [...this.skippedHashes].sort(),
    };
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.toJSON(), null, 2)}\n`, "utf8");
    await rename(temporary, this.filePath);
  }
}
