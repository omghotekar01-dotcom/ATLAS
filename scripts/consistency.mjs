#!/usr/bin/env node
/* globals process, console, fetch */
/**
 * Cross-interface conformance check.
 *
 * Verifies that the REST API, the TypeScript SDK and the CLI return the same
 * canonical answer for one selector. Run it against a configured API; it never
 * writes to Arkiv.
 *
 *   node scripts/consistency.mjs --api-url http://127.0.0.1:3000 \
 *     --selector 0xa9059cbb
 *
 * Build the CLI first (`pnpm build`) for the CLI leg. Without credentials, run
 * the explicit fixture harness in another shell:
 *
 *   node scripts/fixture-api.mjs --port 3114
 *   node scripts/consistency.mjs --api-url http://127.0.0.1:3114
 *
 * The fixture proves contract agreement, not live Arkiv data. When real
 * credentials are configured, point the script at the real API instead.
 */
import { execFile } from "node:child_process";
import { isDeepStrictEqual, promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AtlasClient } from "../packages/sdk/dist/index.js";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const apiUrl = argument("api-url", process.env.ATLAS_API_URL ?? "http://127.0.0.1:3000");
const selector = argument("selector", "0xa9059cbb");

const response = await fetch(`${apiUrl}/v1/functions/${encodeURIComponent(selector)}`);
const rest = await response.json();
if (!response.ok) {
  console.error(`REST lookup failed with HTTP ${response.status}:`, rest.error ?? rest);
  process.exit(1);
}

const client = new AtlasClient({ baseUrl: apiUrl });
const sdk = await client.lookupFunction(selector);

const { stdout } = await run(
  process.execPath,
  [path.join(root, "packages/cli/dist/bin.js"), "lookup", selector, "--json", "--api-url", apiUrl],
  { encoding: "utf8" },
);
const cli = JSON.parse(stdout);

const signatures = (value) => value.candidates.map((candidate) => candidate.signature).sort();

const checks = {
  "REST = SDK": isDeepStrictEqual(rest, sdk),
  "REST candidates = CLI candidates": signatures(rest).join("|") === signatures(cli).join("|"),
  "CLI identifier = REST identifier": cli.identifier === rest.identifier,
};

let failed = false;
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed = true;
}

console.log(
  `\nSelector ${selector}: ${rest.candidates.length} candidate(s) — ${signatures(rest).join(", ") || "none"}`,
);
process.exitCode = failed ? 1 : 0;
