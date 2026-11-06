/**
 * Import pipeline: pinned snapshot -> extraction -> validation -> report.
 *
 * The pipeline never contacts Arkiv. Network access happens only in `fetch.ts`
 * when a snapshot is fetched; Arkiv writes happen only in the CLI's explicit
 * import command. A `--source-dir` run is described as a local snapshot with its
 * own tree digest so reports from fixtures and from real checkouts are never
 * confused.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { EventSignature, FunctionSignature } from "@atlas/schemas";

import { loadLocalSnapshot } from "./fetch.js";
import { buildRecords } from "./normalize.js";
import {
  buildProvenance,
  buildReport,
  parseSourceId,
  type ImportReport,
  type ProvenanceEntry,
} from "./report.js";
import type { Snapshot } from "./snapshot.js";
import { extractProject, type ParsedSourceFile, type Rejection } from "./solidity.js";
import type { ExtractionSource } from "./sources.js";

/** Directories that never contain importable first-party Solidity source. */
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build", "out", "coverage"]);

export interface DryRunOptions {
  readonly source: ExtractionSource;
  /** Local checkout or source directory. Mutually exclusive with `snapshot`. */
  readonly sourceDir?: string;
  /** A fetched snapshot (from `fetchSnapshot`). Mutually exclusive with `sourceDir`. */
  readonly snapshot?: Snapshot;
  readonly datasetVersion?: string;
  readonly now?: Date;
}

export interface DryRunResult {
  readonly functions: FunctionSignature[];
  readonly events: EventSignature[];
  readonly report: ImportReport;
  readonly snapshot: Snapshot;
}

function defaultDatasetVersion(source: ExtractionSource, now: Date): string {
  return `${source.id}@${source.commitSha.slice(0, 12)}-${now.toISOString().slice(0, 10)}`;
}

async function listSolidityFiles(root: string, relativeDir = ""): Promise<string[]> {
  const directory = path.join(root, relativeDir);
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      files.push(...(await listSolidityFiles(root, relativePath)));
    } else if (entry.isFile() && entry.name.endsWith(".sol")) {
      files.push(relativePath);
    }
  }

  return files;
}

/** Reads every Solidity file under `root` in deterministic path order. */
export async function readSolidityProject(root: string): Promise<ParsedSourceFile[]> {
  const files = await listSolidityFiles(root);
  const project: ParsedSourceFile[] = [];
  for (const file of files) {
    project.push({ path: file, content: await readFile(path.join(root, file), "utf8") });
  }
  return project;
}

function draftRejections(
  rejections: readonly {
    kind: "function" | "event";
    signature: string;
    sourceId: string;
    reason: string;
  }[],
): Rejection[] {
  return rejections.map((rejection) => ({
    filePath: parseSourceId(rejection.sourceId).filePath,
    kind: rejection.kind,
    declaration: rejection.signature,
    reason: rejection.reason,
  }));
}

function countOverloads(functions: readonly FunctionSignature[]): number {
  const byName = new Map<string, Set<string>>();
  for (const record of functions) {
    const name = record.signature.slice(0, record.signature.indexOf("("));
    const signatures = byName.get(name) ?? new Set<string>();
    signatures.add(record.signature);
    byName.set(name, signatures);
  }
  return [...byName.values()].filter((signatures) => signatures.size > 1).length;
}

function countCollisions(functions: readonly FunctionSignature[]): number {
  const bySelector = new Map<string, Set<string>>();
  for (const record of functions) {
    const signatures = bySelector.get(record.selector) ?? new Set<string>();
    signatures.add(record.signature);
    bySelector.set(record.selector, signatures);
  }
  return [...bySelector.values()].filter((signatures) => signatures.size > 1).length;
}

export async function runDryRun(options: DryRunOptions): Promise<DryRunResult> {
  if ((options.sourceDir === undefined) === (options.snapshot === undefined)) {
    throw new Error("Provide exactly one of sourceDir or snapshot.");
  }

  const now = options.now ?? new Date();
  const startedAt = now.toISOString();
  const datasetVersion = options.datasetVersion ?? defaultDatasetVersion(options.source, now);

  const snapshot =
    options.snapshot ??
    (await loadLocalSnapshot(options.source, options.sourceDir!, {
      now,
    }));

  const project = await readSolidityProject(snapshot.scanDir);
  const extraction = extractProject(project, options.source);

  const records = await buildRecords(extraction, {
    datasetVersion,
    importedAt: startedAt,
  });

  const rejections = [...extraction.rejections, ...draftRejections(records.rejections)];

  const functionIdentifiers = new Map(
    records.functions.map((record) => [record.recordHash, record.selector]),
  );
  const eventIdentifiers = new Map(
    records.events.map((record) => [record.recordHash, record.topic0]),
  );
  const provenance: ProvenanceEntry[] = [
    ...buildProvenance(records.functions, "function", functionIdentifiers),
    ...buildProvenance(records.events, "event", eventIdentifiers),
  ];

  const selectors = [...new Set(records.functions.map((record) => record.selector))];
  const topics = [...new Set(records.events.map((record) => record.topic0))];

  const report = buildReport({
    source: options.source,
    snapshot: snapshot.metadata,
    datasetVersion,
    startedAt,
    completedAt: new Date().toISOString(),
    dryRun: true,
    scannedFiles: project.length,
    declarations: extraction.functions.length + extraction.events.length,
    functions: records.functions.length,
    events: records.events.length,
    duplicates: records.duplicates,
    imported: 0,
    rejections,
    provenance,
    selectors,
    topics,
    overloadedFunctions: countOverloads(records.functions),
    collidingSelectors: countCollisions(records.functions),
  });

  return { functions: records.functions, events: records.events, report, snapshot };
}

export function summarizeRejections(rejections: readonly Rejection[]): string {
  if (rejections.length === 0) return "No rejected declarations.";
  const byReason = new Map<string, number>();
  for (const rejection of rejections) {
    byReason.set(rejection.reason, (byReason.get(rejection.reason) ?? 0) + 1);
  }
  return [...byReason.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => `  ${count}x ${reason}`)
    .join("\n");
}
