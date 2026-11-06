import { HashSchema, normalizeSelector, type Hash, type Selector } from "@atlas/schemas";

import type { CanonicalEventRecord, CanonicalFunctionRecord, SearchPage } from "./types.js";

export const IMPORTED_AT = "2026-11-06T00:00:00.000Z";
export const DATASET = "openzeppelin-contracts@efaa6f78ab1d-2026-11-02";

export function functionRecord(
  signature: string,
  selector: string,
  suffix: string,
  source = "OpenZeppelin/openzeppelin-contracts",
): CanonicalFunctionRecord {
  return {
    selector: normalizeSelector(selector),
    signature,
    source,
    sourceId: `efaa6f78ab1d:${suffix}`,
    importedAt: IMPORTED_AT,
    datasetVersion: DATASET,
    recordHash: HashSchema.parse(`0x${suffix.padEnd(64, "0").slice(0, 64)}`),
    entityKey: `0x${suffix.padEnd(64, "1").slice(0, 64)}`,
  };
}

export function eventRecord(
  signature: string,
  topic0: string,
  suffix: string,
  indexed?: readonly boolean[],
): CanonicalEventRecord {
  return {
    topic0: topic0 as CanonicalEventRecord["topic0"],
    signature,
    ...(indexed ? { indexed } : {}),
    source: "OpenZeppelin/openzeppelin-contracts",
    sourceId: `efaa6f78ab1d:${suffix}`,
    importedAt: IMPORTED_AT,
    datasetVersion: DATASET,
    recordHash: HashSchema.parse(`0x${suffix.padEnd(64, "0").slice(0, 64)}`),
    entityKey: `0x${suffix.padEnd(64, "1").slice(0, 64)}`,
  };
}

export function memoryRepository(records: readonly CanonicalFunctionRecord[]) {
  return {
    findBySelector: async (selector: Selector) =>
      records.filter((record) => record.selector === selector),
    findByRecordHash: async (hash: Hash) => records.filter((record) => record.recordHash === hash),
    searchBySignature: async (
      query: string,
      options: { limit: number; cursor?: string },
    ): Promise<SearchPage<CanonicalFunctionRecord>> => {
      const matches = records.filter((record) =>
        record.signature.toLowerCase().includes(query.toLowerCase()),
      );
      const start = options.cursor ? Number(options.cursor) : 0;
      const items = matches.slice(start, start + options.limit);
      const next = start + options.limit < matches.length ? String(start + options.limit) : null;
      return { items, nextCursor: next };
    },
  };
}

export function memoryEventRepository(records: readonly CanonicalEventRecord[]) {
  return {
    findByTopic0: async (topic0: string) => records.filter((record) => record.topic0 === topic0),
  };
}
