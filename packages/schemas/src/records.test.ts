import { describe, expect, it } from "vitest";
import {
  EventSignatureSchema,
  FunctionSignatureSchema,
  ImportManifestSchema,
  ObservationSchema,
} from "./records.js";

const hash = `0x${"1".repeat(64)}`;
const timestamp = "2026-11-05T10:00:00Z";

describe("record schemas", () => {
  it("validates and normalizes function signatures while allowing selector collisions", () => {
    const record = {
      selector: "0xA9059CBB",
      signature: "transfer ( address , uint256 )",
      source: "ethereum-lists/4bytes",
      sourceId: "12345",
      importedAt: timestamp,
      datasetVersion: "snapshot-1",
      recordHash: hash,
    };

    expect(FunctionSignatureSchema.parse(record)).toMatchObject({
      selector: "0xa9059cbb",
      signature: "transfer(address,uint256)",
    });
    expect(FunctionSignatureSchema.parse({ ...record, sourceId: "67890" }).sourceId).toBe("67890");
    expect(FunctionSignatureSchema.safeParse({ ...record, selector: "0x1234" }).success).toBe(
      false,
    );
  });

  it("validates event signatures with a topic0", () => {
    const result = EventSignatureSchema.safeParse({
      topic0: `0x${"a".repeat(64)}`,
      signature: "Transfer(address,address,uint256)",
      source: "test-source",
      sourceId: "event-1",
      importedAt: timestamp,
      datasetVersion: "snapshot-1",
      recordHash: hash,
    });

    expect(result.success).toBe(true);
  });

  it("requires observation identifiers to match the declared kind", () => {
    const base = {
      signature: "transfer(address,uint256)",
      chainId: "global",
      contractAddress: "global",
      status: "unverified",
      submittedAt: timestamp,
      observationHash: hash,
    };

    expect(
      ObservationSchema.safeParse({
        ...base,
        kind: "function",
        identifier: "0xa9059cbb",
      }).success,
    ).toBe(true);
    expect(
      ObservationSchema.safeParse({
        ...base,
        kind: "function",
        identifier: `0x${"a".repeat(64)}`,
      }).success,
    ).toBe(false);
  });

  it("validates import counts and manifest metadata", () => {
    const manifest = {
      source: "ethereum-lists/4bytes",
      endpoint: "https://example.com/data",
      importerVersion: "1.0.0",
      datasetVersion: "snapshot-1",
      startedAt: timestamp,
      counts: { fetched: 2, validated: 2, imported: 1, skipped: 1, failed: 0 },
      failureSummary: [],
      licenseUrl: "https://example.com/license",
      importerIdentity: "atlas-local-importer",
    };

    expect(ImportManifestSchema.safeParse(manifest).success).toBe(true);
    expect(
      ImportManifestSchema.safeParse({
        ...manifest,
        counts: { ...manifest.counts, failed: -1 },
      }).success,
    ).toBe(false);
  });
});
