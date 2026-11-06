import type { ChainReader } from "@atlas/chain";
import type { CanonicalEventRecord, CanonicalFunctionRecord } from "@atlas/core";
import {
  HashSchema,
  normalizeSelector,
  normalizeTopic0,
  NotFoundError,
  type Hash,
  type Selector,
} from "@atlas/schemas";

import type { ApiDependencies, ChainStore } from "./deps.js";

export const IMPORTED_AT = "2026-11-06T00:00:00.000Z";

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
    datasetVersion: "openzeppelin-contracts@efaa6f78ab1d-2026-11-02",
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
    topic0: normalizeTopic0(topic0),
    signature,
    ...(indexed ? { indexed } : {}),
    source: "OpenZeppelin/openzeppelin-contracts",
    sourceId: `efaa6f78ab1d:${suffix}`,
    importedAt: IMPORTED_AT,
    datasetVersion: "openzeppelin-contracts@efaa6f78ab1d-2026-11-02",
    recordHash: HashSchema.parse(`0x${suffix.padEnd(64, "0").slice(0, 64)}`),
    entityKey: `0x${suffix.padEnd(64, "1").slice(0, 64)}`,
  };
}

export function memoryFunctions(records: readonly CanonicalFunctionRecord[]) {
  return {
    findBySelector: async (selector: Selector) =>
      records.filter((record) => record.selector === selector),
    findByRecordHash: async (hash: Hash) => records.filter((record) => record.recordHash === hash),
    searchBySignature: async (query: string, options: { limit: number; cursor?: string }) => {
      const matches = records.filter((record) =>
        record.signature.toLowerCase().includes(query.toLowerCase()),
      );
      const start = options.cursor ? Number(options.cursor) : 0;
      const items = matches.slice(start, start + options.limit);
      return {
        items,
        nextCursor: start + options.limit < matches.length ? String(start + options.limit) : null,
      };
    },
  };
}

export function memoryEvents(records: readonly CanonicalEventRecord[]) {
  return {
    findByTopic0: async (topic0: string) => records.filter((record) => record.topic0 === topic0),
  };
}

export function chainStore(readers: ReadonlyMap<number, ChainReader>): ChainStore {
  return {
    get(chainId: number) {
      const reader = readers.get(chainId);
      if (!reader) throw new NotFoundError(`Chain ${chainId} is not supported.`);
      return reader;
    },
  };
}

export function fakeReader(overrides: Partial<ChainReader> = {}): ChainReader {
  return {
    chainId: 1 as never,
    getTransaction: async () => {
      throw new Error("not configured");
    },
    getReceipt: async () => null,
    getBlockNumber: async () => 1n,
    ...overrides,
  };
}

export function makeDependencies(overrides: Partial<ApiDependencies> = {}): ApiDependencies {
  return {
    functions: memoryFunctions([]),
    events: memoryEvents([]),
    chains: chainStore(new Map()),
    health: async () => ({ arkiv: { connected: true } }),
    version: "test",
    ...overrides,
  };
}
