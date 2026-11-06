/**
 * Snapshot identity and licence evidence.
 *
 * A snapshot is the exact file tree checked out at a pinned commit. Its identity
 * is a deterministic SHA-256 over every file path and file content hash, so two
 * machines that fetch the same commit agree on one digest and an import report
 * can be reproduced from it. The licence file is hashed and verified against the
 * value pinned in `sources.ts`.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertValidSource, type ExtractionSource } from "./sources.js";

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const SNAPSHOT_FILE = "snapshot.json";

export type SnapshotMethod = "git" | "local";

export interface SnapshotLicense {
  readonly spdx: string;
  readonly file: string;
  readonly sha256: string;
  readonly url: string;
  /** True when the file hash matched the value pinned in `sources.ts`. */
  readonly verified: boolean;
}

export interface SnapshotMetadata {
  readonly schemaVersion: number;
  readonly sourceId: string;
  readonly repo: string;
  readonly commitSha: string;
  readonly commitDate: string;
  readonly method: SnapshotMethod;
  readonly fetchedAt: string;
  readonly tree: {
    readonly digest: string;
    readonly files: number;
    readonly bytes: number;
  };
  readonly license: SnapshotLicense;
  readonly importerVersion: string;
}

export interface Snapshot {
  readonly root: string;
  readonly treeDir: string;
  /** Directory to scan for Solidity files (`tree` plus the source root). */
  readonly scanDir: string;
  readonly metadata: SnapshotMetadata;
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  return `0x${createHash("sha256").update(bytes).digest("hex")}`;
}

export async function sha256File(filePath: string): Promise<string> {
  return sha256Bytes(await readFile(filePath));
}

async function listFiles(root: string, relativeDir = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, relativeDir), { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === ".git") continue;
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

export interface TreeSummary {
  readonly digest: string;
  readonly files: number;
  readonly bytes: number;
}

/**
 * Hashes `path\0fileSha256\n` for every file in sorted path order. File modification
 * time, owner and line endings do not participate, but byte content does.
 */
export async function computeTreeDigest(root: string): Promise<TreeSummary> {
  const files = await listFiles(root);
  const overall = createHash("sha256");
  let bytes = 0;

  for (const file of files) {
    const absolute = path.join(root, file);
    const content = await readFile(absolute);
    bytes += content.byteLength;
    const fileHash = createHash("sha256").update(content).digest("hex");
    overall.update(`${file}\u0000${fileHash}\n`, "utf8");
  }

  return { digest: `0x${overall.digest("hex")}`, files: files.length, bytes };
}

export async function readSnapshotMetadata(root: string): Promise<SnapshotMetadata> {
  const raw = await readFile(path.join(root, SNAPSHOT_FILE), "utf8");
  const parsed: unknown = JSON.parse(raw);
  return parseMetadata(parsed);
}

function parseMetadata(value: unknown): SnapshotMetadata {
  if (typeof value !== "object" || value === null) {
    throw new Error("Snapshot metadata is not an object.");
  }
  const candidate = value as Partial<SnapshotMetadata>;
  if (candidate.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported snapshot schema ${String(candidate.schemaVersion)}; expected ${SNAPSHOT_SCHEMA_VERSION}.`,
    );
  }
  if (
    typeof candidate.sourceId !== "string" ||
    typeof candidate.commitSha !== "string" ||
    !/^[a-f0-9]{40}$/.test(candidate.commitSha) ||
    typeof candidate.tree?.digest !== "string" ||
    !/^0x[a-f0-9]{64}$/.test(candidate.tree.digest) ||
    typeof candidate.license?.sha256 !== "string"
  ) {
    throw new Error("Snapshot metadata is incomplete or malformed.");
  }
  return candidate as SnapshotMetadata;
}

export async function writeSnapshotMetadata(
  root: string,
  metadata: SnapshotMetadata,
): Promise<void> {
  await mkdir(root, { recursive: true });
  const target = path.join(root, SNAPSHOT_FILE);
  const temporary = `${target}.tmp`;
  await writeFile(temporary, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  await rename(temporary, target);
}

export async function verifyLicense(
  source: ExtractionSource,
  treeDir: string,
): Promise<SnapshotLicense> {
  const licensePath = path.join(treeDir, source.licenseFile);
  const exists = await stat(licensePath).then(
    (entry) => entry.isFile(),
    () => false,
  );

  if (!exists) {
    return {
      spdx: source.license,
      file: source.licenseFile,
      sha256: "",
      url: source.licenseUrl,
      verified: false,
    };
  }

  const sha256 = await sha256File(licensePath);
  return {
    spdx: source.license,
    file: source.licenseFile,
    sha256,
    url: source.licenseUrl,
    verified: sha256 === source.licenseFileSha256,
  };
}

export async function assertLicense(
  source: ExtractionSource,
  treeDir: string,
): Promise<SnapshotLicense> {
  const license = await verifyLicense(source, treeDir);
  if (!license.verified) {
    throw new Error(
      `Licence verification failed for ${source.id}: ${source.licenseFile} hash ${license.sha256 || "<missing>"} does not match pinned ${source.licenseFileSha256}.`,
    );
  }
  return license;
}

export function snapshotScanDir(source: ExtractionSource, treeDir: string): string {
  return source.sourceRoot ? path.join(treeDir, source.sourceRoot) : treeDir;
}

export function buildSnapshotMetadata(
  source: ExtractionSource,
  input: {
    method: SnapshotMethod;
    fetchedAt: string;
    tree: TreeSummary;
    license: SnapshotLicense;
    importerVersion: string;
  },
): SnapshotMetadata {
  assertValidSource(source);
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sourceId: source.id,
    repo: source.repo,
    commitSha: source.commitSha,
    commitDate: source.commitDate,
    method: input.method,
    fetchedAt: input.fetchedAt,
    tree: input.tree,
    license: input.license,
    importerVersion: input.importerVersion,
  };
}

/** Recomputes the tree digest and checks it against recorded metadata. */
export async function verifySnapshotIntegrity(
  snapshot: Snapshot,
): Promise<{ tree: TreeSummary; matches: boolean }> {
  const tree = await computeTreeDigest(snapshot.treeDir);
  return { tree, matches: tree.digest === snapshot.metadata.tree.digest };
}
