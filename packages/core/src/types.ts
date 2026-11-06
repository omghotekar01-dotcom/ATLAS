import type { Hash, Selector, Topic0 } from "@atlas/schemas";

/** Canonical function record as returned by a signature repository adapter. */
export interface CanonicalFunctionRecord {
  readonly selector: Selector;
  readonly signature: string;
  readonly source: string;
  readonly sourceId: string;
  readonly importedAt: string;
  readonly datasetVersion: string;
  readonly recordHash: Hash;
  readonly entityKey: string;
}

/** Canonical event record as returned by a signature repository adapter. */
export interface CanonicalEventRecord {
  readonly topic0: Topic0;
  readonly signature: string;
  readonly source: string;
  readonly sourceId: string;
  readonly importedAt: string;
  readonly datasetVersion: string;
  readonly recordHash: Hash;
  readonly entityKey: string;
  /**
   * Indexed-parameter layout in declaration order, when the snapshot recorded
   * it. Absent means ATLAS must not guess how topics were split.
   */
  readonly indexed?: readonly boolean[];
}

export interface SearchOptions {
  readonly limit: number;
  readonly cursor?: string;
}

export interface SearchPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

/**
 * Read port for canonical function signatures. Core never imports an Arkiv SDK;
 * `@atlas/arkiv` implements this port and service wiring injects it.
 */
export interface FunctionSignatureRepository {
  findBySelector(selector: Selector): Promise<readonly CanonicalFunctionRecord[]>;
  findByRecordHash(recordHash: Hash): Promise<readonly CanonicalFunctionRecord[]>;
  searchBySignature(
    query: string,
    options: SearchOptions,
  ): Promise<SearchPage<CanonicalFunctionRecord>>;
}

/** Read port for canonical event signatures. */
export interface EventSignatureRepository {
  findByTopic0(topic0: Topic0): Promise<readonly CanonicalEventRecord[]>;
}

/** An honest empty event port used until the Arkiv event schema ships. */
export class EmptyEventRepository implements EventSignatureRepository {
  async findByTopic0(): Promise<readonly CanonicalEventRecord[]> {
    return [];
  }
}
