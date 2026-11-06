/**
 * Idempotent Arkiv write path for imported function signatures.
 *
 * Content identity, not selector uniqueness, decides what to write: an entity
 * whose `recordHash` already exists is skipped. Each write is attempted once and
 * never retried blindly, because an uncertain create cannot be safely replayed
 * (PRD 07.04). Writes proceed in bounded batches and, when a checkpoint is
 * supplied, progress is persisted after every batch so an interrupted import can
 * resume without re-walking completed records.
 */
import type { FunctionSignature, Hash } from "@atlas/schemas";

import { assertBatchSize, DEFAULT_BATCH_SIZE, type ImportCheckpoint } from "./checkpoint.js";

export interface FunctionRecordRepository {
  findByRecordHash(recordHash: Hash): Promise<readonly unknown[]>;
  put(record: FunctionSignature): Promise<{ entityKey: string; txHash: string }>;
}

export interface WriteFailure {
  readonly recordHash: string;
  readonly signature: string;
  readonly reason: string;
}

export interface WriteResult {
  readonly written: { recordHash: string; signature: string; entityKey: string; txHash: string }[];
  readonly skipped: number;
  readonly failures: WriteFailure[];
  readonly deferredEvents: number;
}

export interface BatchProgress {
  readonly batch: number;
  readonly batches: number;
  readonly written: number;
  readonly skipped: number;
  readonly resumed: number;
  readonly failures: number;
}

export interface WriteOptions {
  readonly eventCount?: number;
  readonly onWrite?: (record: FunctionSignature, index: number, total: number) => void;
}

export interface BatchWriteOptions extends WriteOptions {
  readonly batchSize?: number;
  readonly checkpoint?: ImportCheckpoint;
  /** Maximum records to process in this run, for a bounded trial. */
  readonly maxRecords?: number;
  readonly onBatch?: (progress: BatchProgress) => void;
}

export interface BatchedWriteResult extends WriteResult {
  /** Records already completed in the checkpoint and not re-checked remotely. */
  readonly resumed: number;
  readonly batches: number;
  /** Records beyond `maxRecords` that this run deliberately did not process. */
  readonly deferred: number;
  readonly checkpointState?: ReturnType<ImportCheckpoint["toJSON"]>;
}

function failureFor(record: FunctionSignature, error: unknown): WriteFailure {
  return {
    recordHash: record.recordHash,
    signature: record.signature,
    reason: error instanceof Error ? error.message : "unknown Arkiv write failure",
  };
}

export async function writeFunctionRecordsInBatches(
  records: readonly FunctionSignature[],
  repository: FunctionRecordRepository,
  options: BatchWriteOptions = {},
): Promise<BatchedWriteResult> {
  const batchSize = assertBatchSize(options.batchSize ?? DEFAULT_BATCH_SIZE);
  const ordered = [...records].sort((left, right) =>
    left.recordHash.localeCompare(right.recordHash),
  );
  const selected =
    options.maxRecords === undefined ? ordered : ordered.slice(0, options.maxRecords);
  const deferred = ordered.length - selected.length;

  const written: BatchedWriteResult["written"] = [];
  const failures: WriteFailure[] = [];
  let skipped = 0;
  let resumed = 0;
  let batches = 0;

  for (let start = 0; start < selected.length; start += batchSize) {
    const batch = selected.slice(start, start + batchSize);
    batches += 1;

    for (const [offset, record] of batch.entries()) {
      const index = start + offset;

      if (options.checkpoint?.has(record.recordHash)) {
        resumed += 1;
        continue;
      }

      let existing: readonly unknown[];
      try {
        existing = await repository.findByRecordHash(record.recordHash);
      } catch (error) {
        const failure = failureFor(record, error);
        failures.push(failure);
        options.checkpoint?.markFailed(failure);
        continue;
      }

      if (existing.length > 0) {
        skipped += 1;
        options.checkpoint?.markSkipped(record.recordHash);
        continue;
      }

      options.onWrite?.(record, index, selected.length);
      try {
        const { entityKey, txHash } = await repository.put(record);
        written.push({
          recordHash: record.recordHash,
          signature: record.signature,
          entityKey,
          txHash,
        });
        options.checkpoint?.markWritten(record.recordHash);
      } catch (error) {
        const failure = failureFor(record, error);
        failures.push(failure);
        options.checkpoint?.markFailed(failure);
      }
    }

    if (options.checkpoint) await options.checkpoint.commitBatch();
    options.onBatch?.({
      batch: batches,
      batches: Math.ceil(selected.length / batchSize),
      written: written.length,
      skipped,
      resumed,
      failures: failures.length,
    });
  }

  return {
    written,
    skipped,
    failures,
    deferredEvents: options.eventCount ?? 0,
    resumed,
    batches,
    deferred,
    ...(options.checkpoint ? { checkpointState: options.checkpoint.toJSON() } : {}),
  };
}

/** Single-batch convenience wrapper used by tests and small imports. */
export async function writeFunctionRecords(
  records: readonly FunctionSignature[],
  repository: FunctionRecordRepository,
  options: WriteOptions = {},
): Promise<WriteResult> {
  return writeFunctionRecordsInBatches(records, repository, {
    ...options,
    batchSize: Math.min(Math.max(records.length, 1), 100),
  });
}

export interface VerificationResult {
  readonly verified: number;
  readonly missing: string[];
  readonly mismatched: string[];
}

/** Reads every written record back and compares its content hash. */
export async function verifyFunctionRecords(
  records: readonly FunctionSignature[],
  repository: Pick<FunctionRecordRepository, "findByRecordHash">,
  options: { onProgress?: (checked: number, total: number) => void } = {},
): Promise<VerificationResult> {
  const missing: string[] = [];
  const mismatched: string[] = [];
  let verified = 0;

  for (const [index, record] of records.entries()) {
    const stored = await repository.findByRecordHash(record.recordHash);
    if (stored.length === 0) {
      missing.push(record.recordHash);
    } else {
      const match = stored.some(
        (candidate) =>
          typeof candidate === "object" &&
          candidate !== null &&
          "signature" in candidate &&
          (candidate as { signature: unknown }).signature === record.signature &&
          "selector" in candidate &&
          (candidate as { selector: unknown }).selector === record.selector,
      );
      if (match) verified += 1;
      else mismatched.push(record.recordHash);
    }
    options.onProgress?.(index + 1, records.length);
  }

  return { verified, missing, mismatched };
}
