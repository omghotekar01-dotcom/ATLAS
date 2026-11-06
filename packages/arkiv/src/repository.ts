import type { PublicArkivClient, WalletArkivClient } from "@arkiv-network/sdk";
import { ExpirationTime } from "@arkiv-network/sdk";
import { asc, eq, gt } from "@arkiv-network/sdk/query";
import { key } from "@arkiv-network/sdk/schema";
import {
  canonicalJson,
  FunctionSignatureSchema,
  type FunctionSignature,
  type Hash,
  type Selector,
} from "@atlas/schemas";
import { hexToString, stringToBytes, type Address, type Hex } from "viem";
import { FunctionSignatures } from "./schema.js";

const PAGE_SIZE = 100;

export interface StoredFunctionSignature extends FunctionSignature {
  entityKey: Hex;
  creator: Address;
}

interface ArkivFunctionEntity {
  $key: Hex;
  $creator: Address;
  selector: { value: string };
  signature: { value: Hex };
  source: { value: string };
  sourceId: { value: string };
  sourceUpdatedAt?: { value: string } | undefined;
  importedAt: { value: string };
  datasetVersion: { value: string };
  recordHash: { value: string };
}

export function parseStoredFunctionSignature(
  entity: ArkivFunctionEntity,
  trustedCreator: Address,
): StoredFunctionSignature {
  if (entity.$creator.toLowerCase() !== trustedCreator.toLowerCase()) {
    throw new Error(`Arkiv entity ${entity.$key} has an unexpected creator.`);
  }

  const record = FunctionSignatureSchema.parse({
    selector: entity.selector.value,
    signature: hexToString(entity.signature.value),
    source: entity.source.value,
    sourceId: entity.sourceId.value,
    ...(entity.sourceUpdatedAt?.value ? { sourceUpdatedAt: entity.sourceUpdatedAt.value } : {}),
    importedAt: entity.importedAt.value,
    datasetVersion: entity.datasetVersion.value,
    recordHash: entity.recordHash.value,
  });

  return {
    ...record,
    entityKey: entity.$key,
    creator: entity.$creator,
  };
}

type IndexedFilter = "selector" | "recordHash";

export class ArkivFunctionRepository {
  constructor(
    private readonly publicClient: PublicArkivClient,
    private readonly trustedCreator: Address,
    private readonly walletClient?: WalletArkivClient,
  ) {}

  async findBySelector(selector: Selector): Promise<StoredFunctionSignature[]> {
    return this.findByIndexedField("selector", selector);
  }

  /**
   * Finds canonical records by deterministic content hash. The importer uses
   * this to make writes idempotent; it is deliberately not selector-based,
   * because a selector may legitimately hold several signatures.
   */
  async findByRecordHash(recordHash: Hash): Promise<StoredFunctionSignature[]> {
    return this.findByIndexedField("recordHash", recordHash);
  }

  private async findByIndexedField(
    field: IndexedFilter,
    value: string,
  ): Promise<StoredFunctionSignature[]> {
    const records = new Map<string, StoredFunctionSignature>();
    let lastKey: Hex | undefined;

    while (true) {
      let query = this.publicClient
        .select({
          $key: true,
          $creator: true,
          selector: true,
          signature: true,
          source: true,
          sourceId: true,
          sourceUpdatedAt: true,
          importedAt: true,
          datasetVersion: true,
          recordHash: true,
        })
        .from(FunctionSignatures, { onMismatch: "throw" })
        .createdBy(this.trustedCreator)
        .where(field === "selector" ? eq("selector", value) : eq("recordHash", value))
        .orderBy(asc("$key"))
        .limit(PAGE_SIZE);

      if (lastKey) {
        query = query.where(gt("$key", key(lastKey)));
      }

      const { entities } = await query.fetch();
      if (entities.length === 0) break;

      for (const entity of entities) {
        const storedRecord = parseStoredFunctionSignature(entity, this.trustedCreator);
        const record = FunctionSignatureSchema.parse(storedRecord);

        const existing = records.get(record.recordHash);
        if (existing) {
          const existingRecord = FunctionSignatureSchema.parse(existing);
          if (canonicalJson(existingRecord) !== canonicalJson(record)) {
            throw new Error(`Conflicting Arkiv records share hash ${record.recordHash}.`);
          }
        }
        records.set(record.recordHash, storedRecord);
      }

      if (entities.length < PAGE_SIZE) break;
      const last = entities.at(-1)?.$key;
      if (!last || last === lastKey) {
        throw new Error("Arkiv pagination did not advance to a new entity key.");
      }
      lastKey = last;
    }

    return [...records.values()].sort((left, right) =>
      left.recordHash.localeCompare(right.recordHash),
    );
  }

  /**
   * Literal, case-insensitive signature search across every canonical record.
   * Arkiv indexes selectors and hashes, not signature text, so this is an
   * honest full scan of the mirrored dataset; it is bounded by `limit` and
   * returns an offset cursor.
   */
  async searchBySignature(
    queryInput: string,
    options: { limit: number; cursor?: string },
  ): Promise<{ items: StoredFunctionSignature[]; nextCursor: string | null }> {
    const query = queryInput.trim().toLowerCase();
    if (!query) throw new Error("A search query is required.");

    const offset = options.cursor ? Number(options.cursor) : 0;
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error("Search cursor must be a non-negative integer offset.");
    }

    const records = new Map<string, StoredFunctionSignature>();
    let lastKey: Hex | undefined;

    while (true) {
      let request = this.publicClient
        .select({
          $key: true,
          $creator: true,
          selector: true,
          signature: true,
          source: true,
          sourceId: true,
          sourceUpdatedAt: true,
          importedAt: true,
          datasetVersion: true,
          recordHash: true,
        })
        .from(FunctionSignatures, { onMismatch: "throw" })
        .createdBy(this.trustedCreator)
        .orderBy(asc("$key"))
        .limit(PAGE_SIZE);

      if (lastKey) {
        request = request.where(gt("$key", key(lastKey)));
      }

      const { entities } = await request.fetch();
      if (entities.length === 0) break;

      for (const entity of entities) {
        const storedRecord = parseStoredFunctionSignature(entity, this.trustedCreator);
        const record = FunctionSignatureSchema.parse(storedRecord);
        const existing = records.get(record.recordHash);
        if (existing) {
          const existingRecord = FunctionSignatureSchema.parse(existing);
          if (canonicalJson(existingRecord) !== canonicalJson(record)) {
            throw new Error(`Conflicting Arkiv records share hash ${record.recordHash}.`);
          }
        }
        records.set(record.recordHash, storedRecord);
      }

      if (entities.length < PAGE_SIZE) break;
      const last = entities.at(-1)?.$key;
      if (!last || last === lastKey) {
        throw new Error("Arkiv pagination did not advance to a new entity key.");
      }
      lastKey = last;
    }

    const matches = [...records.values()]
      .filter((record) => record.signature.toLowerCase().includes(query))
      .sort(
        (left, right) =>
          left.signature.localeCompare(right.signature) ||
          left.recordHash.localeCompare(right.recordHash),
      );

    const items = matches.slice(offset, offset + options.limit);
    const nextCursor =
      offset + options.limit < matches.length ? String(offset + options.limit) : null;
    return { items, nextCursor };
  }

  async put(recordInput: FunctionSignature): Promise<{ entityKey: Hex; txHash: Hex }> {
    if (!this.walletClient) {
      throw new Error("A wallet client is required to write canonical Arkiv records.");
    }

    const signer = this.walletClient.account;
    if (!signer || signer.address.toLowerCase() !== this.trustedCreator.toLowerCase()) {
      throw new Error("The write wallet must match the configured trusted creator.");
    }

    const record = FunctionSignatureSchema.parse(recordInput);
    const { entityKey, txHash } = await this.walletClient.createEntity(
      FunctionSignatures,
      {
        selector: record.selector,
        signature: stringToBytes(record.signature),
        source: record.source,
        sourceId: record.sourceId,
        ...(record.sourceUpdatedAt ? { sourceUpdatedAt: record.sourceUpdatedAt } : {}),
        importedAt: record.importedAt,
        datasetVersion: record.datasetVersion,
        recordHash: record.recordHash,
      },
      { expiration: ExpirationTime.fromDays(180) },
    );
    return { entityKey, txHash };
  }
}
