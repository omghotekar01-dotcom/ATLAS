#!/usr/bin/env node
/* globals console, process, fetch, URL, AbortSignal */

/**
 * Read-only production smoke check. No secrets, fixture data or Arkiv writes.
 * Run: node scripts/production-smoke.mjs https://<api-domain>
 */
const input = process.argv[2] ?? process.env.ATLAS_API_BASE_URL;

if (!input) {
  console.error("Usage: node scripts/production-smoke.mjs https://<api-domain>");
  process.exit(2);
}

let origin;
try {
  const parsed = new URL(input);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search) {
    throw new Error("Expected a plain HTTPS API origin.");
  }
  origin = parsed.origin;
} catch {
  console.error("Provide a valid HTTPS API origin without credentials or query parameters.");
  process.exit(2);
}

const checks = [
  {
    title: "Arkiv health",
    path: "/health",
    valid: (body) => body?.status === "ok" && body?.arkiv?.connected === true,
  },
  {
    title: "Canonical Arkiv function",
    path: "/v1/functions/0x9010d07c",
    valid: (body) =>
      body?.identifier === "0x9010d07c" &&
      Array.isArray(body?.candidates) &&
      body.candidates.some(
        (record) =>
          record.signature === "getRoleMember(bytes32,uint256)" &&
          record.entityKey?.toLowerCase() ===
            "0x99f6593a55a1ae91590399a059adad2cfb8faa4cf69471d7f23a053ba407a034",
      ),
  },
  {
    title: "Function search",
    path: "/v1/functions/search?q=getRoleMember",
    valid: (body) =>
      Array.isArray(body?.items) &&
      body.items.some((item) => item.signature === "getRoleMember(bytes32,uint256)"),
  },
  {
    title: "Unknown selector is empty",
    path: "/v1/functions/0x00000000",
    valid: (body) => body?.identifier === "0x00000000" && body?.candidates?.length === 0,
  },
];

let failed = 0;
console.log(`ATLAS read-only API smoke: ${origin}`);

for (const check of checks) {
  try {
    const response = await fetch(new URL(check.path, origin), {
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    const type = response.headers.get("content-type") ?? "";
    if (response.status !== 200) {
      throw new Error(
        `HTTP ${response.status}${response.headers.get("x-vercel-error") ? " (Vercel platform error)" : ""}`,
      );
    }
    if (!type.includes("application/json")) throw new Error("Non-JSON API response");
    const body = await response.json();
    if (!check.valid(body)) throw new Error("JSON response did not match expected live data");
    console.log(`PASS ${check.title}`);
  } catch (error) {
    failed += 1;
    console.error(
      `FAIL ${check.title}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

console.log(`Result: ${checks.length - failed}/${checks.length} checks passed`);
if (failed > 0) process.exitCode = 1;
