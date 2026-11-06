/**
 * Dry-run reporting and import manifests.
 *
 * Counts are computed from what actually happened in this run. A dry run never
 * claims imported records: `manifest.counts.imported` stays 0 and the report is
 * marked `dryRun: true`. Reports carry the snapshot digest, licence evidence and
 * record-level provenance so a published dataset can be audited.
 */
import { ImportManifestSchema, type ImportManifest } from "@atlas/schemas";

import type { SnapshotMetadata } from "./snapshot.js";
import type { ExtractionSource } from "./sources.js";
import type { Rejection } from "./solidity.js";
import type { VerificationResult, WriteResult } from "./write.js";

export const IMPORTER_VERSION = "0.3.0";
export const IMPORTER_IDENTITY = "ATLAS importer (pinned-source extraction, Sourcify-free)";

export interface ImportCounts {
  readonly scannedFiles: number;
  readonly declarations: number;
  readonly validated: number;
  readonly duplicates: number;
  readonly rejected: number;
  readonly writableFunctions: number;
  /** Event records are extracted but not writable until the event schema ships. */
  readonly deferredEvents: number;
  readonly uniqueSelectors: number;
  readonly uniqueTopics: number;
  /** Selectors claimed by more than one distinct function signature. */
  readonly collidingSelectors: number;
  /** Function names with more than one distinct signature (overloads). */
  readonly overloadedFunctions: number;
  readonly filesWithRejections: number;
}

export interface ProvenanceEntry {
  readonly recordHash: string;
  readonly kind: "function" | "event";
  readonly identifier: string;
  readonly signature: string;
  readonly sourceId: string;
  readonly filePath: string;
  readonly line: number;
}

export interface ImportWriteSummary {
  readonly written: number;
  readonly remoteSkipped: number;
  readonly resumed: number;
  readonly failed: number;
  readonly batches: number;
  readonly deferredEvents: number;
  /** Entity keys and transaction hashes for every record actually written. */
  readonly entities: readonly {
    readonly recordHash: string;
    readonly signature: string;
    readonly entityKey: string;
    readonly txHash: string;
  }[];
  readonly verification?: VerificationResult;
}

export interface ImportReport {
  readonly dryRun: boolean;
  readonly source: {
    readonly id: string;
    readonly repo: string;
    readonly commitSha: string;
    readonly commitDate: string;
    readonly license: string;
    readonly licenseUrl: string;
  };
  readonly snapshot: SnapshotMetadata;
  readonly datasetVersion: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly counts: ImportCounts;
  readonly coverage: {
    /** Canonical selectors present in the dataset (for the usefulness report). */
    readonly selectors: readonly string[];
  };
  readonly manifest: ImportManifest;
  readonly rejections: readonly Rejection[];
  readonly provenance: readonly ProvenanceEntry[];
  readonly write?: ImportWriteSummary;
  readonly notes: readonly string[];
}

export interface BuildReportInput {
  readonly source: ExtractionSource;
  readonly snapshot: SnapshotMetadata;
  readonly datasetVersion: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly dryRun: boolean;
  readonly scannedFiles: number;
  readonly declarations: number;
  readonly functions: number;
  readonly events: number;
  readonly duplicates: number;
  readonly imported: number;
  readonly rejections: readonly Rejection[];
  readonly provenance: readonly ProvenanceEntry[];
  readonly selectors: readonly string[];
  readonly topics: readonly string[];
  readonly overloadedFunctions: number;
  readonly collidingSelectors: number;
}

export function parseSourceId(sourceId: string): { filePath: string; line: number } {
  const match = /^[a-f0-9]{40}:(.+):(\d+):(.+)$/.exec(sourceId);
  if (!match) return { filePath: "unknown", line: 0 };
  return { filePath: match[1]!, line: Number(match[2]!) };
}

export function buildProvenance(
  records: readonly {
    recordHash: string;
    signature: string;
    sourceId: string;
  }[],
  kind: "function" | "event",
  identifiers: ReadonlyMap<string, string>,
): ProvenanceEntry[] {
  return records.map((record) => {
    const { filePath, line } = parseSourceId(record.sourceId);
    return {
      recordHash: record.recordHash,
      kind,
      identifier: identifiers.get(record.recordHash) ?? "",
      signature: record.signature,
      sourceId: record.sourceId,
      filePath,
      line,
    };
  });
}

export function buildReport(input: BuildReportInput): ImportReport {
  const rejected = input.rejections.length;
  const validated = input.functions + input.events;
  const filesWithRejections = new Set(input.rejections.map((rejection) => rejection.filePath)).size;

  const manifest = ImportManifestSchema.parse({
    source: input.source.repo,
    endpoint: input.source.treeUrl,
    importerVersion: IMPORTER_VERSION,
    datasetVersion: input.datasetVersion,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    counts: {
      fetched: input.declarations,
      validated,
      imported: input.imported,
      skipped: input.duplicates,
      failed: rejected,
    },
    failureSummary: input.rejections.map(
      (rejection) =>
        `${rejection.filePath} [${rejection.kind}] ${rejection.declaration}: ${rejection.reason}`,
    ),
    licenseUrl: input.source.licenseUrl,
    importerIdentity: IMPORTER_IDENTITY,
    snapshot: {
      method: input.snapshot.method,
      treeDigest: input.snapshot.tree.digest,
      files: input.snapshot.tree.files,
      bytes: input.snapshot.tree.bytes,
      fetchedAt: input.snapshot.fetchedAt,
      license: {
        spdx: input.snapshot.license.spdx,
        file: input.snapshot.license.file,
        sha256: input.snapshot.license.sha256,
        url: input.snapshot.license.url,
        verified: input.snapshot.license.verified,
      },
    },
  });

  const notes: string[] = [];
  if (input.dryRun) {
    notes.push("Dry run: no Arkiv client was constructed and no entity was written.");
  }
  if (input.events > 0) {
    notes.push(
      `${input.events} event signatures were extracted but not written: the Arkiv event-signature schema is not implemented yet.`,
    );
  }
  if (!input.snapshot.license.verified) {
    notes.push(
      `Licence file ${input.snapshot.license.file} was not verified against the pinned hash (local directories often omit it). Fetched snapshots always verify it.`,
    );
  }

  return {
    dryRun: input.dryRun,
    source: {
      id: input.source.id,
      repo: input.source.repo,
      commitSha: input.source.commitSha,
      commitDate: input.source.commitDate,
      license: input.source.license,
      licenseUrl: input.source.licenseUrl,
    },
    snapshot: input.snapshot,
    datasetVersion: input.datasetVersion,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    counts: {
      scannedFiles: input.scannedFiles,
      declarations: input.declarations,
      validated,
      duplicates: input.duplicates,
      rejected,
      writableFunctions: input.functions,
      deferredEvents: input.events,
      uniqueSelectors: input.selectors.length,
      uniqueTopics: input.topics.length,
      collidingSelectors: input.collidingSelectors,
      overloadedFunctions: input.overloadedFunctions,
      filesWithRejections,
    },
    coverage: { selectors: [...input.selectors].sort() },
    manifest,
    rejections: input.rejections,
    provenance: input.provenance,
    notes,
  };
}

/** Produces the post-write report for an import run. */
export function finalizeImportReport(
  report: ImportReport,
  result: WriteResult & { resumed?: number; batches?: number; deferred?: number },
  verification: VerificationResult | undefined,
  completedAt = new Date().toISOString(),
): ImportReport {
  const write: ImportWriteSummary = {
    written: result.written.length,
    remoteSkipped: result.skipped,
    resumed: result.resumed ?? 0,
    failed: result.failures.length,
    batches: result.batches ?? 0,
    deferredEvents: result.deferredEvents,
    entities: result.written.map((entry) => ({
      recordHash: entry.recordHash,
      signature: entry.signature,
      entityKey: entry.entityKey,
      txHash: entry.txHash,
    })),
    ...(verification ? { verification } : {}),
  };

  const imported = result.written.length;
  const skipped = report.counts.duplicates + result.skipped + (result.resumed ?? 0);
  const failed = report.counts.rejected + result.failures.length;

  const manifest = ImportManifestSchema.parse({
    ...report.manifest,
    completedAt,
    counts: {
      fetched: report.manifest.counts.fetched,
      validated: report.manifest.counts.validated,
      imported,
      skipped,
      failed,
    },
    failureSummary: [
      ...report.manifest.failureSummary,
      ...result.failures.map(
        (failure) => `${failure.signature} [write] ${failure.recordHash}: ${failure.reason}`,
      ),
    ],
  });

  return {
    ...report,
    dryRun: false,
    completedAt,
    manifest,
    write,
    notes: [
      ...report.notes.filter((note) => !note.startsWith("Dry run:")),
      verification
        ? `Read-back verified ${verification.verified} records; ${verification.missing.length} missing, ${verification.mismatched.length} mismatched.`
        : "Read-back verification did not run.",
    ],
  };
}
