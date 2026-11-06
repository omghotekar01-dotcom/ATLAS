/**
 * Pinned snapshot fetching.
 *
 * Fetches an exact commit from an HTTPS GitHub remote with a shallow fetch,
 * verifies that HEAD equals the pinned SHA, removes Git metadata, and records the
 * tree digest plus licence evidence. The result is cached by commit so repeat
 * runs are offline and byte-identical. No shell is used; arguments are passed
 * directly to `git`.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { IMPORTER_VERSION } from "./report.js";
import { assertLicense, type SnapshotLicense, sha256File } from "./snapshot.js";
import {
  buildSnapshotMetadata,
  computeTreeDigest,
  readSnapshotMetadata,
  SNAPSHOT_FILE,
  snapshotScanDir,
  verifySnapshotIntegrity,
  writeSnapshotMetadata,
  type Snapshot,
} from "./snapshot.js";
import { assertValidSource, type ExtractionSource } from "./sources.js";

export const DEFAULT_CACHE_ROOT = fileURLToPath(new URL("../.snapshots", import.meta.url));

export interface SnapshotOptions {
  readonly cacheRoot?: string;
  readonly force?: boolean;
  readonly now?: Date;
  /**
   * Override the Git remote (an absolute path or file:// URL). Used for local
   * mirrors and tests; production callers use the pinned GitHub URL.
   */
  readonly gitRemote?: string;
  readonly onProgress?: (message: string) => void;
}

async function runGit(args: readonly string[], cwd: string, timeoutMs = 300_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [
        "-c",
        "core.autocrlf=false",
        "-c",
        "core.eol=lf",
        "-c",
        "advice.detachedHead=false",
        ...args,
      ],
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GIT_LFS_SKIP_SMUDGE: "1",
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = `${stderr}`.trim() || error.message;
          reject(new Error(`git ${args[0] ?? ""} failed: ${detail}`));
          return;
        }
        resolve(`${stdout}`.trim());
      },
    );
  });
}

export function snapshotRoot(source: ExtractionSource, cacheRoot = DEFAULT_CACHE_ROOT): string {
  return path.join(cacheRoot, source.id, source.commitSha);
}

export function snapshotFromMetadata(
  source: ExtractionSource,
  root: string,
  metadata: Awaited<ReturnType<typeof readSnapshotMetadata>>,
  treeDir = path.join(root, "tree"),
): Snapshot {
  return {
    root,
    treeDir,
    scanDir: snapshotScanDir(source, treeDir),
    metadata,
  };
}

async function loadCachedSnapshot(
  source: ExtractionSource,
  root: string,
  verify: boolean,
): Promise<Snapshot | null> {
  if (!existsSync(path.join(root, SNAPSHOT_FILE))) return null;
  const metadata = await readSnapshotMetadata(root);
  if (metadata.sourceId !== source.id || metadata.commitSha !== source.commitSha) {
    throw new Error(`Cached snapshot at ${root} does not match ${source.id}@${source.commitSha}.`);
  }

  const snapshot = snapshotFromMetadata(source, root, metadata);
  await assertLicense(source, snapshot.treeDir);
  if (verify) {
    const integrity = await verifySnapshotIntegrity(snapshot);
    if (!integrity.matches) {
      throw new Error(
        `Cached snapshot ${root} failed integrity verification (expected ${metadata.tree.digest}, found ${integrity.tree.digest}). Re-run with --force.`,
      );
    }
  }
  return snapshot;
}

export async function fetchSnapshot(
  source: ExtractionSource,
  options: SnapshotOptions = {},
): Promise<Snapshot> {
  assertValidSource(source);
  const cacheRoot = options.cacheRoot ?? DEFAULT_CACHE_ROOT;
  const now = options.now ?? new Date();
  const root = snapshotRoot(source, cacheRoot);

  if (!options.force) {
    const cached = await loadCachedSnapshot(source, root, true);
    if (cached) {
      options.onProgress?.(`Using cached snapshot ${root}`);
      return cached;
    }
  } else {
    await rm(root, { recursive: true, force: true });
  }

  await mkdir(path.dirname(root), { recursive: true });
  const temporary = `${root}.tmp-${process.pid}-${Date.now()}`;
  const treeDir = path.join(temporary, "tree");
  await rm(temporary, { recursive: true, force: true });
  await mkdir(treeDir, { recursive: true });

  try {
    options.onProgress?.(`Fetching ${source.repo}@${source.commitSha.slice(0, 12)}`);
    await runGit(["init", "-q"], treeDir);
    await runGit(["remote", "add", "origin", options.gitRemote ?? source.repositoryUrl], treeDir);
    await runGit(["fetch", "--depth", "1", "origin", source.commitSha], treeDir);
    await runGit(["checkout", "-q", "--detach", "FETCH_HEAD"], treeDir);

    const head = await runGit(["rev-parse", "HEAD"], treeDir);
    if (head !== source.commitSha) {
      throw new Error(
        `Fetched commit ${head} does not match pinned ${source.commitSha} for ${source.id}.`,
      );
    }

    await rm(path.join(treeDir, ".git"), { recursive: true, force: true });

    const license = await assertLicense(source, treeDir);
    const tree = await computeTreeDigest(treeDir);
    const metadata = buildSnapshotMetadata(source, {
      method: "git",
      fetchedAt: now.toISOString(),
      tree,
      license,
      importerVersion: IMPORTER_VERSION,
    });
    await writeSnapshotMetadata(temporary, metadata);
    await rm(root, { recursive: true, force: true });
    await rename(temporary, root);
    options.onProgress?.(
      `Snapshot ${source.id}@${source.commitSha.slice(0, 12)}: ${tree.files} files, ${tree.bytes} bytes, digest ${tree.digest.slice(0, 18)}…`,
    );

    return snapshotFromMetadata(source, root, metadata);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

export interface LocalSnapshotOptions {
  readonly now?: Date;
  /** Require the licence file to be present and match its pinned hash. */
  readonly requireLicense?: boolean;
}

/**
 * Describes a user-supplied checkout without fetching. Licence verification is
 * best-effort because callers often point at a subdirectory (for example
 * `contracts/`), which does not contain the repository licence file.
 */
export async function loadLocalSnapshot(
  source: ExtractionSource,
  sourceDir: string,
  options: LocalSnapshotOptions = {},
): Promise<Snapshot> {
  assertValidSource(source);
  const tree = await computeTreeDigest(sourceDir);
  const licensePath = path.join(sourceDir, source.licenseFile);
  const licenseExists = existsSync(licensePath);
  let license: SnapshotLicense;
  if (licenseExists) {
    const sha256 = await sha256File(licensePath);
    license = {
      spdx: source.license,
      file: source.licenseFile,
      sha256,
      url: source.licenseUrl,
      verified: sha256 === source.licenseFileSha256,
    };
  } else {
    license = {
      spdx: source.license,
      file: source.licenseFile,
      sha256: "",
      url: source.licenseUrl,
      verified: false,
    };
  }

  if (options.requireLicense && !license.verified) {
    throw new Error(
      `Licence file ${source.licenseFile} is missing or does not match the pinned hash for ${source.id}.`,
    );
  }

  const metadata = buildSnapshotMetadata(source, {
    method: "local",
    fetchedAt: (options.now ?? new Date()).toISOString(),
    tree,
    license,
    importerVersion: IMPORTER_VERSION,
  });

  return {
    root: sourceDir,
    treeDir: sourceDir,
    scanDir: sourceDir,
    metadata,
  };
}
