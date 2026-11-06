import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
const exportTargets = [
  packageJson.main,
  packageJson.types,
  packageJson.exports?.["."]?.import,
  packageJson.exports?.["."]?.types,
];

for (const target of exportTargets) {
  assert.equal(typeof target, "string", "Every package entry point must be declared.");
  assert.ok(existsSync(resolve(packageRoot, target)), `Missing package export target: ${target}`);
}

const publicApi = await import("@atlas/api");
for (const name of [
  "API_VERSION",
  "createApp",
  "createDefaultDependencies",
  "DEV_CORS_ORIGINS",
  "isAllowedOrigin",
  "normalizeOrigin",
  "parseCorsOriginList",
  "resolveCorsPolicy",
  "investigateTransaction",
  "withTimeout",
]) {
  assert.ok(name in publicApi, `Package import is missing public export: ${name}`);
}

const declarations = readFileSync(resolve(packageRoot, packageJson.types), "utf8");
for (const name of [
  "CreateAppOptions",
  "CorsPolicy",
  "CorsPolicyOptions",
  "ApiDependencies",
  "ChainStore",
]) {
  assert.ok(declarations.includes(name), `Package declarations are missing public type: ${name}`);
}
