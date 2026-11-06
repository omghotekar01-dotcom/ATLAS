import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { main, parseArgs, UsageError } from "./cli.js";

const fixtures = fileURLToPath(new URL("../fixtures", import.meta.url));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("importer CLI arguments", () => {
  it("parses a dry run and resolves paths", () => {
    const options = parseArgs([
      "dry-run",
      "--source",
      "openzeppelin-contracts",
      "--source-dir",
      fixtures,
      "--dataset-version",
      "snapshot-1",
      "--json",
    ]);

    expect(options).toMatchObject({
      command: "dry-run",
      sourceId: "openzeppelin-contracts",
      sourceDir: path.resolve(fixtures),
      datasetVersion: "snapshot-1",
      json: true,
      confirmWrite: false,
      batchSize: 25,
    });
  });

  it("parses fetch, snapshot and bounded import options", () => {
    expect(parseArgs(["dry-run", "--source", "openzeppelin-contracts", "--fetch"])).toMatchObject({
      command: "dry-run",
      fetch: true,
    });
    expect(parseArgs(["snapshot", "--source", "ethereum-ercs", "--force"])).toMatchObject({
      command: "snapshot",
      force: true,
      fetch: true,
    });
    expect(
      parseArgs([
        "import",
        "--source",
        "openzeppelin-contracts",
        "--source-dir",
        fixtures,
        "--confirm-write",
        "--batch-size",
        "10",
        "--max-records",
        "5",
        "--checkpoint",
        "state.json",
        "--resume",
      ]),
    ).toMatchObject({ batchSize: 10, maxRecords: 5, resume: true, confirmWrite: true });
  });

  it("requires an explicit write confirmation for imports", () => {
    expect(() =>
      parseArgs(["import", "--source", "openzeppelin-contracts", "--source-dir", fixtures]),
    ).toThrow(UsageError);
  });

  it("rejects conflicting or invalid options", () => {
    expect(() =>
      parseArgs([
        "dry-run",
        "--source",
        "openzeppelin-contracts",
        "--source-dir",
        fixtures,
        "--fetch",
      ]),
    ).toThrow("mutually exclusive");
    expect(() => parseArgs(["dry-run", "--source", "openzeppelin-contracts"])).toThrow(
      "Provide --source-dir",
    );
    expect(() =>
      parseArgs([
        "import",
        "--source",
        "openzeppelin-contracts",
        "--source-dir",
        fixtures,
        "--confirm-write",
        "--batch-size",
        "101",
      ]),
    ).toThrow("1 to 100");
    expect(() =>
      parseArgs([
        "import",
        "--source",
        "openzeppelin-contracts",
        "--source-dir",
        fixtures,
        "--confirm-write",
        "--resume",
      ]),
    ).toThrow("--resume requires --checkpoint");
    expect(() => parseArgs(["verify"])).toThrow("verify requires --report");
  });

  it("rejects unknown commands, options and missing values", () => {
    expect(() => parseArgs([])).toThrow("command is required");
    expect(() => parseArgs(["nope"])).toThrow('Unknown command "nope"');
    expect(() => parseArgs(["dry-run", "--source"])).toThrow("--source requires a value");
    expect(() =>
      parseArgs(["dry-run", "--source", "openzeppelin-contracts", "--source-dir", fixtures, "--x"]),
    ).toThrow('Unknown option "--x"');
  });
});

describe("importer CLI dry run", () => {
  it("writes a valid report file without contacting Arkiv", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "atlas-importer-"));
    const reportPath = path.join(directory, "report.json");
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      const code = await main([
        "dry-run",
        "--source",
        "openzeppelin-contracts",
        "--source-dir",
        fixtures,
        "--report",
        reportPath,
      ]);

      expect(code).toBe(0);
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        dryRun: boolean;
        snapshot: { method: string; tree: { digest: string } };
        provenance: { recordHash: string; filePath: string; line: number }[];
        counts: { writableFunctions: number; deferredEvents: number };
        manifest: { counts: { imported: number } };
      };
      expect(report.dryRun).toBe(true);
      expect(report.snapshot.method).toBe("local");
      expect(report.snapshot.tree.digest).toMatch(/^0x[0-9a-f]{64}$/);
      expect(report.counts.writableFunctions).toBe(9);
      expect(report.counts.deferredEvents).toBe(2);
      expect(report.manifest.counts.imported).toBe(0);
      expect(report.provenance.length).toBe(11);
      expect(report.provenance.every((entry) => entry.filePath !== "unknown")).toBe(true);
      expect(stdout).toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("returns usage exit code 2 for an import without confirmation", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const code = await main([
      "import",
      "--source",
      "openzeppelin-contracts",
      "--source-dir",
      fixtures,
    ]);

    expect(code).toBe(2);
    expect(stderr).toHaveBeenCalled();
  });
});
