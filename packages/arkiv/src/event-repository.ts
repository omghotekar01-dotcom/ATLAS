import { ExpirationTime, type PublicArkivClient, type WalletArkivClient } from "@arkiv-network/sdk";
import { asc, eq, gt } from "@arkiv-network/sdk/query";
import { key } from "@arkiv-network/sdk/schema";
import {
  canonicalJson,
  EventSignatureSchema,
  type EventSignature,
  type Hash,
  type Topic0,
} from "@atlas/schemas";
import { hexToString, stringToBytes, type Address, type Hex } from "viem";

import { EventSignatures } from "./schema.js";

const PAGE_SIZE = 100;

export interface StoredEventSignature extends EventSignature {
  entityKey: Hex;
  creator: Address;
}

interface ArkivEventEntity {
  $key: Hex;
  $creator: Address;
  topic0: { value: string };
  signature: { value: Hex };
  indexed?: { value: string } | undefined;
  source: { value: string };
  sourceId: { value: string };
  importedAt: { value: string };
  datasetVersion: { value: string };
  recordHash: { value: string };
}

/** Encodes a pinned indexed layout as `1,0,1`; absent stays absent. */
export function encodeIndexedLayout(indexed: readonly boolean[]): string {
  return indexed.map((value) => (value ? "1" : "0")).join(",");
}

export function decodeIndexedLayout(value: string | undefined): boolean[] | undefined {
  if (value === undefined) return undefined;
  const parts = value.split(",");
  if (parts.length === 0) return undefined;
  return parts.map((part) => {
    if (part === "1") return true;
    if (part === "0") return false;
    throw new Error(`Invalid indexed layout segment "${part}".`);
  });
}

export function parseStoredEventSignature(
  entity: ArkivEventEntity,
  trustedCreator: Address,
): StoredEventSignature {
  if (entity.$creator.toLowerCase() !== trustedCreator.toLowerCase()) {
    throw new Error("Arkiv entity has an unexpected creator.");
  }

  const indexed = decodeIndexedLayout(entity.indexed?.value);

  const record = EventSignatureSchema.parse({
    topic0: entity.topic0.value,
    signature: hexToString(entity.signature.value),
    ...(indexed ? { indexed } : {}),
    source: entity.source.value,
    sourceId: entity.sourceId.value,
    importedAt: entity.importedAt.value,
    datasetVersion: entity.datasetVersion.value,
    recordHash: entity.recordHash.value,
  });

  return { ...record, entityKey: entity.$key, creator: entity.$creator };
}

/**
 * Read-only adapter for the canonical event-signature schema. It never guesses
 * an indexed layout: a missing layout stays missing so the decoder can refuse
 * ambiguous topic splits.
 */
export class ArkivEventRepository {
  constructor(
    private readonly publicClient: PublicArkivClient,
    private readonly trustedCreator: Address,
    private readonly walletClient?: WalletArkivClient,
  ) {}

  async findByTopic0(topic0: Topic0): Promise<StoredEventSignature[]> {
    return this.findByIndexedField("topic0", topic0);
  }

  /** Deterministic content-hash lookup for idempotent writes and read-back. */
  async findByRecordHash(recordHash: Hash): Promise<StoredEventSignature[]> {
    return this.findByIndexedField("recordHash", recordHash);
  }

  private async findByIndexedField(
    field: "topic0" | "recordHash",
    value: string,
  ): Promise<StoredEventSignature[]> {
    const records = new Map<string, StoredEventSignature>();
    let lastKey: Hex | undefined;

    while (true) {
      let query = this.publicClient
        .select({
          $key: true,
          $creator: true,
          topic0: true,
          signature: true,
          indexed: true,
          source: true,
          sourceId: true,
          importedAt: true,
          datasetVersion: true,
          recordHash: true,
        })
        .from(EventSignatures, { onMismatch: "throw" })
        .createdBy(this.trustedCreator)
        .where(eq(field, value))
        .orderBy(asc("$key"))
        .limit(PAGE_SIZE);

      if (lastKey) query = query.where(gt("$key", key(lastKey)));

      const { entities } = await query.fetch();
      if (entities.length === 0) break;

      for (const entity of entities) {
        const stored = parseStoredEventSignature(entity, this.trustedCreator);
        const record = EventSignatureSchema.parse(stored);
        const existing = records.get(record.recordHash);
        if (existing) {
          const existingRecord = EventSignatureSchema.parse(existing);
          if (canonicalJson(existingRecord) !== canonicalJson(record)) {
            throw new Error(`Conflicting Arkiv event records share hash ${record.recordHash}.`);
          }
        }
        records.set(record.recordHash, stored);
      }

      if (entities.length < PAGE_SIZE) break;
      const last = entities.at(-1)?.$key;
      if (!last || last === lastKey) {
        throw new Error("Arkiv event pagination did not advance to a new entity key.");
      }
      lastKey = last;
    }

    return [...records.values()].sort((left, right) =>
      left.recordHash.localeCompare(right.recordHash),
    );
  }

  /** Public Rabdi write, only for explicitly approved offline importer runs. */
  async put(recordInput: EventSignature): Promise<{ entityKey: Hex; txHash: Hex }> {
    if (!this.walletClient) {
      throw new Error("A wallet client is required to write Arkiv event records.");
    }

    const signer = this.walletClient.account;
    if (!signer || signer.address.toLowerCase() !== this.trustedCreator.toLowerCase()) {
      throw new Error("The event-write wallet must match the configured trusted creator.");
    }

    const record = EventSignatureSchema.parse(recordInput);
    const { entityKey, txHash } = await this.walletClient.createEntity(
      EventSignatures,
      {
        topic0: record.topic0,
        signature: stringToBytes(record.signature),
        ...(record.indexed ? { indexed: encodeIndexedLayout(record.indexed) } : {}),
        source: record.source,
        sourceId: record.sourceId,
        importedAt: record.importedAt,
        datasetVersion: record.datasetVersion,
        recordHash: record.recordHash,
      },
      { expiration: ExpirationTime.fromDays(180) },
    );

    return { entityKey, txHash };
  }
}

/** Converts a canonical record into schema values for a future importer write. */
export function toEventSchemaValues(record: EventSignature): Record<string, unknown> {
  return {
    topic0: record.topic0,
    signature: stringToBytes(record.signature),
    ...(record.indexed ? { indexed: encodeIndexedLayout(record.indexed) } : {}),
    source: record.source,
    sourceId: record.sourceId,
    importedAt: record.importedAt,
    datasetVersion: record.datasetVersion,
    recordHash: record.recordHash,
  };
}
