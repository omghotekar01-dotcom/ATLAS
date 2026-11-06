/**
 * Explicit, separately approved import path for event signatures on Arkiv
 * Rabdi. Never invoked by the read-only Vercel API.
 *
 * Usage:
 *   node dist/event-import.js --source openzeppelin-contracts --fetch
 *     --dataset-version openzeppelin-contracts@efaa6f78ab1d-2026-11-06
 *     --max-records 1 --confirm-write
 *
 * Required: ARKIV_ACCESS_KEY, ARKIV_PRIVATE_KEY, trusted creator address, and
 * ATLAS_WRITE_APPROVAL=<datasetVersion>:events.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ArkivEventRepository,
  checkArkivHealth,
  createArkivPublicClient,
  createArkivWalletClient,
  readArkivEnvironment,
} from "@atlas/arkiv";

import { ImportCheckpoint, type CheckpointIdentity } from "./checkpoint.js";
import { parseArgs } from "./cli.js";
import { writeEventRecordsInBatches, verifyEventRecords } from "./event-write.js";
import { fetchSnapshot, loadLocalSnapshot } from "./fetch.js";
import { runDryRun } from "./pipeline.js";
import { finalizeImportReport } from "./report.js";
import { getSource } from "./sources.js";

export async function importEvents(args: readonly string[]): Promise<number> {
  const options = parseArgs(["import", ...args]);
  const source = getSource(options.sourceId!);
  const snapshot = options.sourceDir
    ? await loadLocalSnapshot(source, options.sourceDir)
    : await fetchSnapshot(source, {
        ...(options.cacheRoot ? { cacheRoot: options.cacheRoot } : {}),
        force: options.force,
      });
  if (!snapshot.metadata.license.verified) {
    throw new Error("The pinned source licence must be verified before writing event entities.");
  }

  const { events, report } = await runDryRun({
    source,
    snapshot,
    ...(options.datasetVersion ? { datasetVersion: options.datasetVersion } : {}),
  });
  if (events.length === 0) throw new Error("No validated event signatures were found.");

  const expectedApproval = `${report.datasetVersion}:events`;
  const limit = options.maxRecords ?? events.length;
  process.stdout.write(
    [
      "",
      "========== ARKIV EVENT WRITE APPROVAL GATE ==========",
      "Network: Arkiv Rabdi; chain: 7794095",
      `Creator/signer: must match ATLAS_ARKIV_CREATOR_ADDRESS`,
      `Source: ${source.repo} @ ${source.commitSha}`,
      `Licence: ${source.license}; verified: ${snapshot.metadata.license.verified}`,
      `Tree digest: ${snapshot.metadata.tree.digest}`,
      `Dataset: ${report.datasetVersion}`,
      `Validated event records: ${events.length}`,
      `Records in this run: ${Math.min(events.length, limit)}`,
      "Expiry: 180 days; on-chain writes irreversible; uncertain writes are not retried",
      `Approval token required: ATLAS_WRITE_APPROVAL=${expectedApproval}`,
      "======================================================",
      "",
    ].join("\n"),
  );

  // Gate BEFORE wallet creation and network write. The importer never falls
  // back to a fabricated account or an implicit approval from function imports.
  if (process.env.ATLAS_WRITE_APPROVAL?.trim() !== expectedApproval) {
    throw new Error("Event import approval is missing; no transaction was attempted.");
  }

  const environment = readArkivEnvironment();
  const wallet = createArkivWalletClient(environment);
  const signer = wallet.account?.address;
  if (!signer) throw new Error("An event-write wallet is required.");
  const trusted = process.env.ATLAS_ARKIV_CREATOR_ADDRESS?.trim();
  if (!trusted || signer.toLowerCase() !== trusted.toLowerCase()) {
    throw new Error("Signer does not match trusted creator. No write was attempted.");
  }

  const publicClient = createArkivPublicClient(environment.accessKey);
  const health = await checkArkivHealth(publicClient);
  if (health.status !== "ok") throw new Error("Rabdi health check failed; no write was attempted.");

  const checkpointPath =
    options.checkpointPath ??
    path.resolve(".atlas-checkpoints", `${report.datasetVersion}-events.json`);
  const identity: CheckpointIdentity = {
    datasetVersion: report.datasetVersion,
    sourceId: `${source.id}:events`,
    commitSha: source.commitSha,
    treeDigest: snapshot.metadata.tree.digest,
    batchSize: options.batchSize,
    totalRecords: events.length,
  };
  const { checkpoint } = await ImportCheckpoint.openOrCreate(checkpointPath, identity, {
    ...(options.resume ? { resume: true } : {}),
  });

  const repository = new ArkivEventRepository(publicClient, signer, wallet);
  const result = await writeEventRecordsInBatches(events, repository, {
    batchSize: options.batchSize,
    checkpoint,
    ...(options.maxRecords ? { maxRecords: options.maxRecords } : {}),
    onBatch: (progress) => {
      process.stderr.write(
        `event batch ${progress.batch}/${progress.batches}: written=${progress.written} skipped=${progress.skipped} failed=${progress.failures}\n`,
      );
    },
  });

  const selected = events.slice().sort((a, b) => a.recordHash.localeCompare(b.recordHash))
    .slice(0, Math.min(events.length, limit));
  const verification = await verifyEventRecords(selected, repository);

  const ok =
    result.failures.length === 0 &&
    verification.missing.length === 0 &&
    verification.mismatched.length === 0;
  if (ok && result.deferred === 0) await checkpoint.complete();

  const cleanReport = {
    ...report,
    notes: report.notes.filter((note) => !note.includes("extracted but not written")),
  };
  const finalized = finalizeImportReport(cleanReport, result, verification);
  const output = {
    ...finalized,
    write: { ...finalized.write, kind: "event" as const },
    notes: [
      ...finalized.notes,
      `Event import scope: ${selected.length} of ${events.length} validated event records.`,
    ],
  };
  const filename =
    options.reportPath ??
    path.resolve("docs/reports", `${report.datasetVersion}-events-import.json`);
  await writeFile(filename, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Events: ${result.written.length} written; ${result.skipped} remote skips; ${verification.verified}/${selected.length} verified; report: ${filename}\n`,
  );
  return ok ? 0 : 1;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/event-import.js")) {
  importEvents(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
