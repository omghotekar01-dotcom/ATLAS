import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { fetchSnapshot, loadLocalSnapshot } from "./fetch.js";
import { sha256File } from "./snapshot.js";
import { OPENZEPPELIN_SOURCE, type ExtractionSource } from "./sources.js";

function git(args: readonly string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-c", "user.email=test@atlas.local", "-c", "user.name=ATLAS Test", ...args],
      { cwd, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`${stderr || error.message}`));
        else resolve(`${stdout}`.trim());
      },
    );
  });
}

const directories: string[] = [];

async function temporary(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "atlas-fetch-"));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createRepository(): Promise<{
  root: string;
  commitSha: string;
  source: ExtractionSource;
}> {
  const root = await temporary();
  await git(["init", "-q"], root);
  await writeFile(path.join(root, "LICENSE"), "MIT License\n\nTest fixture licence.\n", "utf8");
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "src", "Token.sol"),
    "pragma solidity ^0.8.24; interface IToken { function transfer(address,uint256) external; }\n",
    "utf8",
  );
  await git(["add", "."], root);
  await git(["commit", "-q", "-m", "fixture"], root);
  const commitSha = await git(["rev-parse", "HEAD"], root);
  const licenseFileSha256 = await sha256File(path.join(root, "LICENSE"));

  return {
    root,
    commitSha,
    source: {
      ...OPENZEPPELIN_SOURCE,
      repositoryUrl: "https://github.com/atlas-test/pinned-fixture.git",
      commitSha,
      licenseFileSha256,
      sourceRoot: "src",
    },
  };
}

describe("pinned snapshot fetching", () => {
  it("fetches an exact commit, verifies the licence and records a tree digest", async () => {
    const { root, commitSha, source } = await createRepository();
    const cacheRoot = path.join(root, "cache");

    const snapshot = await fetchSnapshot(source, {
      cacheRoot,
      gitRemote: pathToFileURL(root).href,
      now: new Date("2026-11-06T00:00:00.000Z"),
    });

    expect(snapshot.metadata.commitSha).toBe(commitSha);
    expect(snapshot.metadata.method).toBe("git");
    expect(snapshot.metadata.license.verified).toBe(true);
    expect(snapshot.metadata.tree.files).toBe(2);
    expect(snapshot.metadata.tree.digest).toMatch(/^0x[0-9a-f]{64}$/);
    expect(snapshot.scanDir.endsWith(`${path.sep}src`)).toBe(true);

    const cached = await fetchSnapshot(source, { cacheRoot });
    expect(cached.metadata.tree.digest).toBe(snapshot.metadata.tree.digest);
    expect(cached.metadata.fetchedAt).toBe(snapshot.metadata.fetchedAt);
  });

  it("rejects a snapshot whose licence does not match the pinned hash", async () => {
    const { root, source } = await createRepository();
    const wrongLicense = { ...source, licenseFileSha256: `0x${"0".repeat(64)}` };

    await expect(
      fetchSnapshot(wrongLicense, {
        cacheRoot: path.join(root, "cache-wrong"),
        gitRemote: pathToFileURL(root).href,
      }),
    ).rejects.toThrow("Licence verification failed");
  });

  it("rejects a source that does not pin a full commit", async () => {
    const { root, source } = await createRepository();
    await expect(
      fetchSnapshot({ ...source, commitSha: "main" }, { cacheRoot: path.join(root, "cache") }),
    ).rejects.toThrow("40-hex commit");
  });

  it("describes a local checkout without a licence file as unverified", async () => {
    const { root } = await createRepository();
    const snapshot = await loadLocalSnapshot(
      { ...OPENZEPPELIN_SOURCE, sourceRoot: "src" },
      path.join(root, "src"),
    );

    expect(snapshot.metadata.method).toBe("local");
    expect(snapshot.metadata.license.verified).toBe(false);
    expect(snapshot.metadata.tree.files).toBe(1);
  });
});
