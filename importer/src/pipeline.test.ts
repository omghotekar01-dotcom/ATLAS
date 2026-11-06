import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { runDryRun, summarizeRejections } from "./pipeline.js";
import { OPENZEPPELIN_SOURCE } from "./sources.js";

const fixtures = fileURLToPath(new URL("../fixtures", import.meta.url));
const now = new Date("2026-11-06T12:00:00.000Z");

describe("offline import pipeline", () => {
  it("scans a local pinned tree and produces validated, collision-safe records", async () => {
    const { functions, events, report } = await runDryRun({
      source: OPENZEPPELIN_SOURCE,
      sourceDir: fixtures,
      now,
    });

    expect(report.counts).toEqual({
      scannedFiles: 3,
      declarations: 13,
      validated: 11,
      duplicates: 2,
      rejected: 2,
      writableFunctions: 9,
      deferredEvents: 2,
      uniqueSelectors: 8,
      uniqueTopics: 2,
      collidingSelectors: 1,
      overloadedFunctions: 0,
      filesWithRejections: 1,
    });
    expect(report.dryRun).toBe(true);
    expect(report.datasetVersion).toBe("openzeppelin-contracts@efaa6f78ab1d-2026-11-06");
    expect(report.manifest.counts).toEqual({
      fetched: 13,
      validated: 11,
      imported: 0,
      skipped: 2,
      failed: 2,
    });
    expect(report.manifest.licenseUrl).toBe(OPENZEPPELIN_SOURCE.licenseUrl);
    expect(report.manifest.snapshot?.license.verified).toBe(false);
    expect(report.rejections).toHaveLength(2);

    const signatures = functions.map((record) => record.signature).sort();
    expect(signatures).toEqual([
      "approve(address,uint256)",
      "balanceOf(address)",
      "deposit()",
      "dynamicArray(bytes32[])",
      "fixedArray(uint256[2])",
      "many_msg_babbage(bytes1)",
      "move((uint256,uint256))",
      "publicEntry(address)",
      "transfer(address,uint256)",
    ]);
    expect(new Set(events.map((record) => record.signature))).toEqual(
      new Set(["Approval(address,address,uint256)", "Transfer(address,address,uint256)"]),
    );

    const colliding = functions.filter((record) => record.selector === "0xa9059cbb");
    expect(colliding.map((record) => record.signature).sort()).toEqual([
      "many_msg_babbage(bytes1)",
      "transfer(address,uint256)",
    ]);

    expect(report.provenance).toHaveLength(11);
    expect(report.provenance.every((entry) => entry.line > 0)).toBe(true);
  });

  it("produces a deterministic snapshot digest for the same tree", async () => {
    const first = await runDryRun({ source: OPENZEPPELIN_SOURCE, sourceDir: fixtures, now });
    const second = await runDryRun({ source: OPENZEPPELIN_SOURCE, sourceDir: fixtures, now });

    expect(second.report.snapshot.tree.digest).toBe(first.report.snapshot.tree.digest);
    expect(second.report.snapshot.tree.files).toBe(first.report.snapshot.tree.files);
  });

  it("reports no writes and keeps event records deferred", async () => {
    const { report } = await runDryRun({
      source: OPENZEPPELIN_SOURCE,
      sourceDir: fixtures,
      now,
    });

    expect(report.manifest.counts.imported).toBe(0);
    expect(report.notes[0]).toContain("Dry run");
    expect(report.notes.join(" ")).toContain("2 event signatures");
  });

  it("requires exactly one of sourceDir or snapshot", async () => {
    await expect(runDryRun({ source: OPENZEPPELIN_SOURCE, now } as never)).rejects.toThrow(
      "exactly one",
    );
  });

  it("summarizes rejection reasons with counts", () => {
    const summary = summarizeRejections([
      { filePath: "A.sol", kind: "function", declaration: "a", reason: "same reason" },
      { filePath: "B.sol", kind: "function", declaration: "b", reason: "same reason" },
      { filePath: "C.sol", kind: "event", declaration: "c", reason: "other reason" },
    ]);

    expect(summary).toContain("2x same reason");
    expect(summary).toContain("1x other reason");
  });
});
