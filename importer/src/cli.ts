/**
 * ATLAS importer CLI.
 *
 *   atlas-importer snapshot --source <id> [--force]
 *   atlas-importer dry-run  --source <id> (--fetch | --source-dir <path>) [--report <file>]
 *   atlas-importer import   --source <id> (--fetch | --source-dir <path>) --confirm-write
 *   atlas-importer verify   --report <file>
 *   atlas-importer doctor
 *
 * `dry-run` never contacts Arkiv. `import` is a public Rabdi write and requires
 * both `--confirm-write` and an explicit `ATLAS_WRITE_APPROVAL` token equal to
 * the dataset version, after printing the exact network, signer, record count,
 * provenance, expiry and irreversibility. No write is ever retried blindly.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { FunctionSignature, Hash } from "@atlas/schemas";

import {
  assertBatchSize,
  DEFAULT_BATCH_SIZE,
  ImportCheckpoint,
  type CheckpointIdentity,
} from "./checkpoint.js";
import { fetchSnapshot, loadLocalSnapshot } from "./fetch.js";
import { runDryRun, summarizeRejections } from "./pipeline.js";
import { finalizeImportReport, IMPORTER_VERSION, type ImportReport } from "./report.js";
import type { Snapshot } from "./snapshot.js";
import { getSource, SOURCES } from "./sources.js";
import { verifyFunctionRecords, writeFunctionRecordsInBatches } from "./write.js";

type Command = "snapshot" | "dry-run" | "import" | "verify" | "doctor";

export interface CliOptions {
  readonly command: Command;
  readonly sourceId?: string;
  readonly sourceDir?: string;
  readonly fetch: boolean;
  readonly cacheRoot?: string;
  readonly force: boolean;
  readonly datasetVersion?: string;
  readonly json: boolean;
  readonly reportPath?: string;
  readonly confirmWrite: boolean;
  readonly batchSize: number;
  readonly checkpointPath?: string;
  readonly resume: boolean;
  readonly fresh: boolean;
  readonly maxRecords?: number;
}

export class UsageError extends Error {}

const USAGE = `ATLAS importer ${IMPORTER_VERSION}

Usage:
  atlas-importer snapshot --source <id> [--cache <dir>] [--force] [--json]
  atlas-importer dry-run  --source <id> (--fetch | --source-dir <path>) [--json] [--report <file>]
  atlas-importer import   --source <id> (--fetch | --source-dir <path>) --confirm-write
                          [--batch-size 1..100] [--checkpoint <file>] [--resume|--fresh]
                          [--max-records <n>] [--report <file>] [--json]
  atlas-importer verify   --report <file> [--json]
  atlas-importer doctor   [--json]

Sources: ${SOURCES.map((source) => `${source.id} (${source.license}, ${source.commitSha.slice(0, 12)})`).join(", ")}

Dry runs never contact Arkiv. Imports require --confirm-write, ARKIV_ACCESS_KEY,
ARKIV_PRIVATE_KEY, and ATLAS_WRITE_APPROVAL set to the exact dataset version.
Imports write to Rabdi (chain 7794095) and are public and irreversible.`;

function positiveInteger(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new UsageError(`${option} requires a positive integer.`);
  }
  return parsed;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const [command, ...rest] = argv;
  if (
    command !== "snapshot" &&
    command !== "dry-run" &&
    command !== "import" &&
    command !== "verify" &&
    command !== "doctor"
  ) {
    throw new UsageError(
      command
        ? `Unknown command "${command}".`
        : "A command is required (snapshot, dry-run, import, verify or doctor).",
    );
  }

  let sourceId: string | undefined;
  let sourceDir: string | undefined;
  let cacheRoot: string | undefined;
  let datasetVersion: string | undefined;
  let reportPath: string | undefined;
  let checkpointPath: string | undefined;
  let maxRecords: number | undefined;
  let batchSize = DEFAULT_BATCH_SIZE;
  let json = false;
  let confirmWrite = false;
  let fetch = false;
  let force = false;
  let resume = false;
  let fresh = false;

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]!;
    const value = () => {
      const next = rest[index + 1];
      if (!next || next.startsWith("--")) throw new UsageError(`${argument} requires a value.`);
      index += 1;
      return next;
    };

    switch (argument) {
      case "--source":
        sourceId = value();
        break;
      case "--source-dir":
        sourceDir = value();
        break;
      case "--cache":
        cacheRoot = value();
        break;
      case "--dataset-version":
        datasetVersion = value();
        break;
      case "--report":
        reportPath = value();
        break;
      case "--checkpoint":
        checkpointPath = value();
        break;
      case "--batch-size":
        batchSize = assertBatchSize(positiveInteger(value(), "--batch-size"));
        break;
      case "--max-records":
        maxRecords = positiveInteger(value(), "--max-records");
        break;
      case "--fetch":
        fetch = true;
        break;
      case "--force":
        force = true;
        break;
      case "--resume":
        resume = true;
        break;
      case "--fresh":
        fresh = true;
        break;
      case "--json":
        json = true;
        break;
      case "--confirm-write":
        confirmWrite = true;
        break;
      default:
        throw new UsageError(`Unknown option "${argument}".`);
    }
  }

  if (command === "doctor") {
    return {
      command,
      fetch: false,
      force: false,
      json,
      confirmWrite: false,
      batchSize,
      resume: false,
      fresh: false,
    };
  }

  if (command === "verify") {
    if (!reportPath) throw new UsageError("verify requires --report <file>.");
    return {
      command,
      fetch: false,
      force: false,
      json,
      confirmWrite: false,
      batchSize,
      resume: false,
      fresh: false,
      reportPath: path.resolve(reportPath),
    };
  }

  if (!sourceId) throw new UsageError("--source is required.");
  const source = getSource(sourceId);

  if (command === "snapshot") {
    return {
      command,
      sourceId,
      fetch: true,
      force,
      json,
      confirmWrite: false,
      batchSize,
      resume: false,
      fresh: false,
      ...(cacheRoot ? { cacheRoot: path.resolve(cacheRoot) } : {}),
    };
  }

  if (sourceDir && fetch) {
    throw new UsageError("--source-dir and --fetch are mutually exclusive.");
  }
  if (!sourceDir && !fetch) {
    throw new UsageError(
      "Provide --source-dir <local checkout> or --fetch to download the pinned snapshot.",
    );
  }

  if (resume && fresh) throw new UsageError("--resume and --fresh are mutually exclusive.");
  if (resume && !checkpointPath) {
    throw new UsageError("--resume requires --checkpoint <file>.");
  }
  if (command === "import" && !confirmWrite) {
    throw new UsageError(
      "import writes to the public Rabdi network. Re-run with --confirm-write after the required approval.",
    );
  }
  if (command !== "import" && (confirmWrite || resume || fresh || checkpointPath)) {
    throw new UsageError(
      "--confirm-write, --resume, --fresh and --checkpoint are only valid for import.",
    );
  }

  void source;
  return {
    command,
    sourceId,
    ...(sourceDir ? { sourceDir: path.resolve(sourceDir) } : {}),
    ...(cacheRoot ? { cacheRoot: path.resolve(cacheRoot) } : {}),
    fetch,
    force,
    ...(datasetVersion ? { datasetVersion } : {}),
    json,
    ...(reportPath ? { reportPath: path.resolve(reportPath) } : {}),
    confirmWrite,
    batchSize,
    ...(checkpointPath ? { checkpointPath: path.resolve(checkpointPath) } : {}),
    resume,
    fresh,
    ...(maxRecords ? { maxRecords } : {}),
  };
}

async function resolveSnapshot(
  source: ReturnType<typeof getSource>,
  options: CliOptions,
): Promise<Snapshot> {
  if (options.sourceDir) {
    return loadLocalSnapshot(source, options.sourceDir, { now: new Date() });
  }
  return fetchSnapshot(source, {
    ...(options.cacheRoot ? { cacheRoot: options.cacheRoot } : {}),
    force: options.force,
    onProgress: (message) => process.stderr.write(`${message}\n`),
  });
}

function printSnapshot(sourceId: string, snapshot: Snapshot): void {
  const { metadata } = snapshot;
  process.stdout.write(
    [
      `Source:      ${metadata.repo}`,
      `Commit:      ${metadata.commitSha} (${metadata.commitDate})`,
      `Method:      ${metadata.method}`,
      `Licence:     ${metadata.license.spdx} (${metadata.license.file}, verified: ${metadata.license.verified})`,
      `Tree digest: ${metadata.tree.digest}`,
      `Files/bytes: ${metadata.tree.files} / ${metadata.tree.bytes}`,
      `Snapshot:    ${snapshot.root}`,
      `Scan dir:    ${snapshot.scanDir}`,
      `Dataset:     ${sourceId}@${metadata.commitSha.slice(0, 12)}`,
    ].join("\n") + "\n",
  );
}

function printHumanReport(report: ImportReport): void {
  const { counts } = report;
  const lines = [
    `Source:       ${report.source.repo} @ ${report.source.commitSha}`,
    `Licence:      ${report.source.license} (${report.snapshot.license.file}, verified: ${report.snapshot.license.verified})`,
    `Snapshot:     ${report.datasetVersion}`,
    `Tree digest:  ${report.snapshot.tree.digest}`,
    `Files:        ${counts.scannedFiles}`,
    `Declarations: ${counts.declarations}`,
    `Validated:    ${counts.validated} (${counts.writableFunctions} functions, ${counts.deferredEvents} events)`,
    `Unique:       ${counts.uniqueSelectors} selectors, ${counts.uniqueTopics} topics`,
    `Overloads:    ${counts.overloadedFunctions} function names`,
    `Collisions:   ${counts.collidingSelectors} selectors with multiple signatures`,
    `Duplicates:   ${counts.duplicates} collapsed`,
    `Rejected:     ${counts.rejected} declarations in ${counts.filesWithRejections} files`,
    `Dry run:      ${report.dryRun}`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  if (counts.rejected > 0) {
    process.stdout.write(`\nRejection summary:\n${summarizeRejections(report.rejections)}\n`);
  }
  for (const note of report.notes) process.stdout.write(`\nNote: ${note}\n`);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function defaultCheckpointPath(datasetVersion: string): string {
  const safe = datasetVersion.replace(/[^A-Za-z0-9._-]+/g, "-");
  return path.resolve(".atlas-checkpoints", `${safe}.json`);
}

interface WritePlan {
  readonly network: string;
  readonly chainId: number;
  readonly signer: string;
  readonly datasetVersion: string;
  readonly records: number;
  readonly provenance: {
    readonly source: string;
    readonly commitSha: string;
    readonly treeDigest: string;
    readonly licence: string;
    readonly licenceVerified: boolean;
  };
  readonly expirationDays: number;
  readonly batchSize: number;
  readonly checkpoint: string;
  readonly maxRecords?: number;
}

function printWritePlan(plan: WritePlan): void {
  process.stdout.write(
    [
      "",
      "================ RABDI WRITE PLAN ================",
      `Network:        ${plan.network} (chain ID ${plan.chainId})`,
      `Signer:         ${plan.signer}`,
      `Dataset:        ${plan.datasetVersion}`,
      `Records:        ${plan.records} function records`,
      `Source:         ${plan.provenance.source}`,
      `Commit:         ${plan.provenance.commitSha}`,
      `Tree digest:    ${plan.provenance.treeDigest}`,
      `Licence:        ${plan.provenance.licence} (verified: ${plan.provenance.licenceVerified})`,
      `Expiration:     ${plan.expirationDays} days (public testnet entities)`,
      `Batch size:     ${plan.batchSize}`,
      `Checkpoint:     ${plan.checkpoint}`,
      `Trial limit:    ${plan.maxRecords ?? "none (all records)"}`,
      "Irreversible:   writes are public, creator-attributed and cannot be edited; expiry cannot be reversed.",
      `Approval:       set ATLAS_WRITE_APPROVAL=${plan.datasetVersion} after explicit human approval.`,
      "==================================================",
      "",
    ].join("\n"),
  );
}

async function importCommand(options: CliOptions): Promise<number> {
  const source = getSource(options.sourceId!);
  const snapshot = await resolveSnapshot(source, options);
  const { functions, report } = await runDryRun({
    source,
    snapshot,
    ...(options.datasetVersion ? { datasetVersion: options.datasetVersion } : {}),
  });

  const arkiv = await import("@atlas/arkiv");
  const environment = arkiv.readArkivEnvironment();
  const publicClient = arkiv.createArkivPublicClient(environment.accessKey);
  const walletClient = arkiv.createArkivWalletClient(environment);
  const account = walletClient.account;
  if (!account) throw new Error("The configured wallet client has no account.");

  const health = await arkiv.checkArkivHealth(publicClient);
  if (health.status !== "ok") {
    throw new Error(
      health.status === "wrong-network"
        ? `Rabdi expected chain ${health.expectedChainId}, received ${health.actualChainId}.`
        : health.message,
    );
  }

  const checkpointPath = options.checkpointPath ?? defaultCheckpointPath(report.datasetVersion);
  const identity: CheckpointIdentity = {
    datasetVersion: report.datasetVersion,
    sourceId: source.id,
    commitSha: source.commitSha,
    treeDigest: snapshot.metadata.tree.digest,
    batchSize: options.batchSize,
    totalRecords: functions.length,
  };
  const { checkpoint, resumed } = await ImportCheckpoint.openOrCreate(checkpointPath, identity, {
    ...(options.resume ? { resume: true } : {}),
  });

  const plan: WritePlan = {
    network: "Rabdi testnet",
    chainId: 7794095,
    signer: account.address,
    datasetVersion: report.datasetVersion,
    records: functions.length,
    provenance: {
      source: source.repo,
      commitSha: source.commitSha,
      treeDigest: snapshot.metadata.tree.digest,
      licence: source.license,
      licenceVerified: snapshot.metadata.license.verified,
    },
    expirationDays: 180,
    batchSize: options.batchSize,
    checkpoint: checkpointPath,
    ...(options.maxRecords ? { maxRecords: options.maxRecords } : {}),
  };
  printWritePlan(plan);

  const approval = process.env.ATLAS_WRITE_APPROVAL?.trim();
  if (approval !== report.datasetVersion) {
    throw new Error(
      `Write approval is missing. Obtain explicit approval for this dataset, then set ATLAS_WRITE_APPROVAL=${report.datasetVersion}. No write was attempted.`,
    );
  }

  process.stdout.write(
    resumed
      ? `Resuming from checkpoint ${checkpointPath} (${checkpoint.completedCount} records already completed).\n`
      : `Starting fresh import with checkpoint ${checkpointPath}.\n`,
  );

  const repository = new arkiv.ArkivFunctionRepository(publicClient, account.address, walletClient);
  const result = await writeFunctionRecordsInBatches(functions, repository, {
    batchSize: options.batchSize,
    checkpoint,
    ...(options.maxRecords ? { maxRecords: options.maxRecords } : {}),
    eventCount: report.counts.deferredEvents,
    onWrite: (record, index, total) => {
      process.stderr.write(`[${index + 1}/${total}] ${record.signature}\n`);
    },
    onBatch: (progress) => {
      process.stderr.write(
        `batch ${progress.batch}/${progress.batches}: written=${progress.written} skipped=${progress.skipped} resumed=${progress.resumed} failed=${progress.failures}\n`,
      );
    },
  });

  const ordered = [...functions].sort((left, right) =>
    left.recordHash.localeCompare(right.recordHash),
  );
  const toVerify = options.maxRecords ? ordered.slice(0, options.maxRecords) : ordered;
  const verification = await verifyFunctionRecords(toVerify, repository, {
    onProgress: (checked, total) => {
      if (checked % 50 === 0 || checked === total) {
        process.stderr.write(`read-back ${checked}/${total}\n`);
      }
    },
  });

  if (result.failures.length === 0 && verification.missing.length === 0) {
    await checkpoint.complete();
  }
  const finalReport = finalizeImportReport(report, result, verification);
  const reportPath =
    options.reportPath ?? path.resolve("docs/reports", `${report.datasetVersion}-import.json`);
  await writeJson(reportPath, finalReport);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(finalReport, null, 2)}\n`);
  } else {
    printHumanReport(finalReport);
    process.stdout.write(
      [
        "",
        `Written:      ${result.written.length}`,
        `Remote skip:  ${result.skipped}`,
        `Resumed:      ${result.resumed}`,
        `Failed:       ${result.failures.length}`,
        `Read-back:    ${verification.verified} verified, ${verification.missing.length} missing, ${verification.mismatched.length} mismatched`,
        `Report:       ${reportPath}`,
        "",
      ].join("\n"),
    );
  }

  return result.failures.length === 0 && verification.missing.length === 0 ? 0 : 1;
}

async function verifyCommand(options: CliOptions): Promise<number> {
  const raw = JSON.parse(await readFile(options.reportPath!, "utf8")) as {
    provenance?: { recordHash?: string; kind?: string; identifier?: string; signature?: string }[];
  };
  if (!Array.isArray(raw.provenance)) {
    throw new Error("Report has no provenance array; cannot verify.");
  }
  const functions = raw.provenance
    .filter((entry) => entry.kind === "function")
    .map((entry) => ({
      recordHash: entry.recordHash as Hash,
      signature: entry.signature ?? "",
      selector: entry.identifier ?? "",
    }));

  const arkiv = await import("@atlas/arkiv");
  const environment = arkiv.readArkivEnvironment();
  const trustedCreator = process.env.ATLAS_ARKIV_CREATOR_ADDRESS?.trim();
  if (!trustedCreator || !/^0x[0-9a-f]{40}$/i.test(trustedCreator)) {
    throw new Error(
      "ATLAS_ARKIV_CREATOR_ADDRESS must be set to the address that created the records.",
    );
  }

  const publicClient = arkiv.createArkivPublicClient(environment.accessKey);
  const health = await arkiv.checkArkivHealth(publicClient);
  if (health.status !== "ok")
    throw new Error("Rabdi health check failed; no verification performed.");

  const repository = new arkiv.ArkivFunctionRepository(
    publicClient,
    trustedCreator as `0x${string}`,
  );
  const verification = await verifyFunctionRecords(
    functions as unknown as FunctionSignature[],
    repository,
  );

  const summary = {
    checked: functions.length,
    verified: verification.verified,
    missing: verification.missing,
    mismatched: verification.mismatched,
  };
  if (options.json) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  else {
    process.stdout.write(
      `Read-back: ${summary.verified}/${summary.checked} verified, ${summary.missing.length} missing, ${summary.mismatched.length} mismatched.\n`,
    );
  }
  return verification.missing.length === 0 && verification.mismatched.length === 0 ? 0 : 1;
}

async function doctorCommand(options: CliOptions): Promise<number> {
  const arkiv = await import("@atlas/arkiv");
  let environment: Awaited<ReturnType<typeof arkiv.readArkivEnvironment>>;
  try {
    environment = arkiv.readArkivEnvironment();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\nSet ARKIV_ACCESS_KEY to a Rabdi access key; no key is printed.\n`,
    );
    return 2;
  }

  const publicClient = arkiv.createArkivPublicClient(environment.accessKey);
  const health = await arkiv.checkArkivHealth(publicClient);
  const result: Record<string, unknown> = { network: "rabdi", health };

  if (environment.privateKey) {
    const walletClient = arkiv.createArkivWalletClient(environment);
    const signer = walletClient.account?.address ?? null;
    const trusted = process.env.ATLAS_ARKIV_CREATOR_ADDRESS?.trim() ?? null;
    result.signer = signer;
    result.trustedCreatorMatches =
      trusted && signer ? trusted.toLowerCase() === signer.toLowerCase() : null;
  } else {
    result.signer = null;
    result.note = "No ARKIV_PRIVATE_KEY; read-only diagnostics only.";
  }

  if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    process.stdout.write(
      [
        `Rabdi:      ${health.status}`,
        health.status === "ok" ? `Chain ID:   ${health.chainId}` : "",
        health.status === "ok" ? `Latency:    ${health.latencyMs} ms` : "",
        health.status === "unavailable" ? `Problem:    ${health.message}` : "",
        health.status === "wrong-network"
          ? `Chain:      expected ${health.expectedChainId}, received ${health.actualChainId}`
          : "",
        `Signer:     ${result.signer ?? "not configured (read-only)"}`,
        result.trustedCreatorMatches === false
          ? "Warning: signer does not match ATLAS_ARKIV_CREATOR_ADDRESS."
          : "",
        "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return health.status === "ok" ? 0 : 1;
}

export async function main(argv: readonly string[]): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n${USAGE}\n`);
      return 2;
    }
    throw error;
  }

  if (options.command === "doctor") return doctorCommand(options);
  if (options.command === "verify") return verifyCommand(options);

  const source = getSource(options.sourceId!);

  if (options.command === "snapshot") {
    const snapshot = await resolveSnapshot(source, options);
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify({ sourceId: source.id, root: snapshot.root, scanDir: snapshot.scanDir, metadata: snapshot.metadata }, null, 2)}\n`,
      );
    } else {
      printSnapshot(source.id, snapshot);
    }
    return 0;
  }

  const snapshot = await resolveSnapshot(source, options);
  const { functions, report } = await runDryRun({
    source,
    snapshot,
    ...(options.datasetVersion ? { datasetVersion: options.datasetVersion } : {}),
  });

  if (options.command === "dry-run") {
    if (options.reportPath) await writeJson(options.reportPath, report);
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ report }, null, 2)}\n`);
    } else {
      printHumanReport(report);
      if (options.reportPath) process.stdout.write(`\nReport written to ${options.reportPath}\n`);
    }
    return 0;
  }

  if (functions.length === 0) {
    throw new Error("No function records to import; nothing was written.");
  }
  return importCommand(options);
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}

if (isDirectRun()) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
