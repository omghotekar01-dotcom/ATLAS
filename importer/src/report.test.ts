import { describe, expect, it } from "vitest";
import { ImportManifestSchema } from "@atlas/schemas";

import { buildReport, finalizeImportReport } from "./report.js";
import type { SnapshotMetadata } from "./snapshot.js";
import { OPENZEPPELIN_SOURCE } from "./sources.js";
import type { Rejection } from "./solidity.js";

const snapshot: SnapshotMetadata = {
  schemaVersion: 1,
  sourceId: "openzeppelin-contracts",
  repo: "OpenZeppelin/openzeppelin-contracts",
  commitSha: OPENZEPPELIN_SOURCE.commitSha,
  commitDate: "2026-11-02",
  method: "local",
  fetchedAt: "2026-11-06T00:00:00.000Z",
  tree: { digest: `0x${"a".repeat(64)}`, files: 3, bytes: 1234 },
  license: {
    spdx: "MIT",
    file: "LICENSE",
    sha256: "",
    url: OPENZEPPELIN_SOURCE.licenseUrl,
    verified: false,
  },
  importerVersion: "0.3.0",
};

const rejection: Rejection = {
  filePath: "Unsupported.sol",
  kind: "function",
  declaration: "callback",
  reason: "function types are not supported by this extractor",
};

function build() {
  return buildReport({
    source: OPENZEPPELIN_SOURCE,
    snapshot,
    datasetVersion: "snapshot-1",
    startedAt: "2026-11-06T00:00:00.000Z",
    completedAt: "2026-11-06T00:00:01.000Z",
    dryRun: true,
    scannedFiles: 3,
    declarations: 12,
    functions: 8,
    events: 2,
    duplicates: 2,
    imported: 0,
    rejections: [rejection],
    provenance: [
      {
        recordHash: `0x${"1".repeat(64)}`,
        kind: "function",
        identifier: "0xa9059cbb",
        signature: "transfer(address,uint256)",
        sourceId: `${OPENZEPPELIN_SOURCE.commitSha}:Example.sol:4:transfer(address,uint256)`,
        filePath: "Example.sol",
        line: 4,
      },
    ],
    selectors: ["0xa9059cbb", "0x095ea7b3"],
    topics: [`0x${"d".repeat(64)}`],
    overloadedFunctions: 0,
    collidingSelectors: 1,
  });
}

describe("import report", () => {
  it("builds a manifest that satisfies the shared schema", () => {
    const report = build();

    expect(() => ImportManifestSchema.parse(report.manifest)).not.toThrow();
    expect(report.manifest.counts).toEqual({
      fetched: 12,
      validated: 10,
      imported: 0,
      skipped: 2,
      failed: 1,
    });
    expect(report.manifest.failureSummary).toEqual([
      "Unsupported.sol [function] callback: function types are not supported by this extractor",
    ]);
    expect(report.manifest.snapshot).toEqual({
      method: "local",
      treeDigest: snapshot.tree.digest,
      files: 3,
      bytes: 1234,
      fetchedAt: snapshot.fetchedAt,
      license: {
        spdx: "MIT",
        file: "LICENSE",
        sha256: "",
        url: OPENZEPPELIN_SOURCE.licenseUrl,
        verified: false,
      },
    });
    expect(report.counts).toMatchObject({
      scannedFiles: 3,
      validated: 10,
      duplicates: 2,
      rejected: 1,
      writableFunctions: 8,
      deferredEvents: 2,
      uniqueSelectors: 2,
      uniqueTopics: 1,
      collidingSelectors: 1,
      filesWithRejections: 1,
    });
  });

  it("states that a dry run wrote nothing and that events are deferred", () => {
    const report = build();

    expect(report.dryRun).toBe(true);
    expect(report.notes).toContain(
      "Dry run: no Arkiv client was constructed and no entity was written.",
    );
    expect(report.notes.join(" ")).toContain("not written");
  });

  it("finalizes an import report with real write evidence and read-back", () => {
    const report = build();
    const finalized = finalizeImportReport(
      report,
      {
        written: [
          {
            recordHash: `0x${"1".repeat(64)}`,
            signature: "transfer(address,uint256)",
            entityKey: "entity-1",
            txHash: `0x${"f".repeat(64)}`,
          },
        ],
        skipped: 1,
        failures: [],
        deferredEvents: 2,
        resumed: 0,
        batches: 1,
        deferred: 0,
      },
      { verified: 1, missing: [], mismatched: [] },
      "2026-11-06T00:00:05.000Z",
    );

    expect(finalized.dryRun).toBe(false);
    expect(finalized.manifest.counts).toEqual({
      fetched: 12,
      validated: 10,
      imported: 1,
      skipped: 3,
      failed: 1,
    });
    expect(finalized.write).toMatchObject({
      written: 1,
      remoteSkipped: 1,
      resumed: 0,
      failed: 0,
      entities: [
        {
          recordHash: `0x${"1".repeat(64)}`,
          signature: "transfer(address,uint256)",
          entityKey: "entity-1",
          txHash: `0x${"f".repeat(64)}`,
        },
      ],
      verification: { verified: 1, missing: [], mismatched: [] },
    });
    expect(finalized.notes.join(" ")).toContain("Read-back verified 1 records");
  });
});
