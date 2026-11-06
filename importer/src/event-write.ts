/**
 * Event-specific, idempotent write / read-back verification.
 *
 * Each record has a distinct content hash and is attempted once. There is no
 * blind retry after a remote failure. Uses an event-only checkpoint to avoid
 * mixing progress with a prior function import from the same source snapshot.
 */
import type { EventSignature, Hash } from "@atlas/schemas";

import { assertBatchSize, DEFAULT_BATCH_SIZE, type ImportCheckpoint } from "./checkpoint.js";
import type { BatchProgress, BatchedWriteResult, VerificationResult } from "./write.js";

export interface EventRecordRepository {
  findByRecordHash(hash: Hash): Promise<readonly unknown[]>;
  put(record: EventSignature): Promise<{ entityKey: string; txHash: string }>;
}

export interface EventBatchWriteOptions {
  readonly batchSize?: number;
  readonly maxRecords?: number;
  readonly checkpoint?: ImportCheckpoint;
  readonly onWrite?: (record: EventSignature, index: number, total: number) => void;
  readonly onBatch?: (progress: BatchProgress) => void;
}

export async function writeEventRecordsInBatches(
  records: readonly EventSignature[],
  repository: EventRecordRepository,
  options: EventBatchWriteOptions = {},
): Promise<BatchedWriteResult> {
  const batchSize = assertBatchSize(options.batchSize ?? DEFAULT_BATCH_SIZE);
  const ordered = [...records].sort((a, b) => a.recordHash.localeCompare(b.recordHash));
  const selected =
    options.maxRecords === undefined ? ordered : ordered.slice(0, options.maxRecords);
  const written: BatchedWriteResult["written"] = [];
  const failures: BatchedWriteResult["failures"][number][] = [];
  let skipped = 0;
  let resumed = 0;
  let batches = 0;

  for (let start = 0; start < selected.length; start += batchSize) {
    const batch = selected.slice(start, start + batchSize);
    batches += 1;
    for (const [offset, record] of batch.entries()) {
      if (options.checkpoint?.has(record.recordHash)) {
        resumed += 1;
        continue;
      }

      try {
        const existing = await repository.findByRecordHash(record.recordHash);
        if (existing.length > 0) {
          skipped += 1;
          options.checkpoint?.markSkipped(record.recordHash);
          continue;
        }
      } catch (error) {
        const failure = {
          recordHash: record.recordHash,
          signature: record.signature,
          reason: error instanceof Error ? error.message : "event hash lookup failed",
        };
        failures.push(failure);
        options.checkpoint?.markFailed(failure);
        continue;
      }

      options.onWrite?.(record, start + offset, selected.length);
      try {
        const result = await repository.put(record);
        written.push({ ...result, recordHash: record.recordHash, signature: record.signature });
        options.checkpoint?.markWritten(record.recordHash);
      } catch (error) {
        const failure = {
          recordHash: record.recordHash,
          signature: record.signature,
          reason: error instanceof Error ? error.message : "event write failed",
        };
        failures.push(failure);
        options.checkpoint?.markFailed(failure);
      }
    }
    await options.checkpoint?.commitBatch();
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
    failures,
    skipped,
    resumed,
    batches,
    deferred: ordered.length - selected.length,
    deferredEvents: 0,
    ...(options.checkpoint ? { checkpointState: options.checkpoint.toJSON() } : {}),
  };
}

export async function verifyEventRecords(
  records: readonly EventSignature[],
  repository: Pick<EventRecordRepository, "findByRecordHash">,
): Promise<VerificationResult> {
  const missing: string[] = [];
  const mismatched: string[] = [];
  let verified = 0;

  for (const record of records) {
    const stored = await repository.findByRecordHash(record.recordHash);
    if (stored.length === 0) {
      missing.push(record.recordHash);
      continue;
    }
    const matching = stored.some((candidate) => {
      if (typeof candidate !== "object" || candidate === null) return false;
      const result = candidate as Partial<EventSignature>;
      return (
        result.recordHash === record.recordHash &&
        result.signature === record.signature &&
        result.topic0 === record.topic0 &&
        JSON.stringify(result.indexed ?? []) === JSON.stringify(record.indexed ?? [])
      );
    });
    if (matching) verified += 1;
    else mismatched.push(record.recordHash);
  }

  return { verified, missing, mismatched };
}
