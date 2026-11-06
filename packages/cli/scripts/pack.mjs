import { execFileSync } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { build } from "esbuild";

const cli = fileURLToPath(new URL("../", import.meta.url));
const root = fileURLToPath(new URL("../../../", import.meta.url));
const name = "@omghotekar01/atlas-cli";
const defaultApiUrl = "https://atlas-api-ivory.vercel.app";
const workspace = JSON.parse(await readFile(join(cli, "package.json"), "utf8"));
const sdk = JSON.parse(await readFile(join(root, "packages/sdk/package.json"), "utf8"));
const destination = join(root, ".cache", "npm");
const staging = await mkdtemp(join(tmpdir(), "atlas-npm-"));

function npm(cwd, ...args) {
  if (process.platform === "win32") {
    // All arguments passed to the shell are fixed literals.
    return execFileSync("cmd.exe", ["/d", "/c", "npm.cmd", ...args], { cwd, encoding: "utf8" });
  }
  return execFileSync("npm", args, { cwd, encoding: "utf8" });
}

try {
  const manifest = {
    name,
    version: workspace.version,
    description:
      "ATLAS command-line tools for EVM signatures, transactions, and sponsor integrations",
    type: "module",
    bin: { atlas: "./bin.js" },
    files: ["bin.js"],
    engines: { node: ">=22.18.0" },
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/omghotekar01-dotcom/ATLAS.git",
      directory: "packages/cli",
    },
    publishConfig: { access: "public", registry: "https://registry.npmjs.org/" },
    dependencies: { commander: workspace.dependencies.commander, zod: sdk.dependencies.zod },
  };

  await build({
    stdin: {
      contents: `import { run } from "./src/cli.ts";
import process from "node:process";
process.exitCode = await run(process.argv.slice(2), { defaultApiUrl: ${JSON.stringify(defaultApiUrl)} });`,
      resolveDir: cli,
      sourcefile: "atlas-npm-entry.ts",
    },
    outfile: join(staging, "bin.js"),
    banner: { js: "#!/usr/bin/env node" },
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    external: Object.keys(manifest.dependencies),
  });
  await chmod(join(staging, "bin.js"), 0o755);
  await writeFile(join(staging, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
  await copyFile(join(cli, "README.md"), join(staging, "README.md"));
  await copyFile(join(root, "LICENSE"), join(staging, "LICENSE"));

  const [packed] = JSON.parse(npm(staging, "pack", "--json", "--ignore-scripts"));
  const archive = join(staging, packed.filename);
  if (process.argv.includes("--smoke")) {
    const fixture = join(staging, "fixture");
    await mkdir(fixture);
    await writeFile(join(fixture, "package.json"), '{"private":true}');
    await copyFile(archive, join(fixture, "atlas-cli.tgz"));
    npm(fixture, "install", "--ignore-scripts", "--no-audit", "--no-fund", "./atlas-cli.tgz");
    const output = npm(fixture, "exec", "--no", "--", "atlas", "--version").trim();
    if (output !== manifest.version)
      throw new Error(`Unexpected installed atlas version: ${output}`);
    const help = npm(fixture, "exec", "--no", "--", "atlas", "--help");
    for (const command of ["lookup", "artifact", "ens-role", "explain", "integrations"]) {
      if (!help.includes(command)) throw new Error(`Installed atlas is missing ${command}.`);
    }
  }
  await mkdir(destination, { recursive: true });
  const output = join(destination, packed.filename);
  await copyFile(archive, output);
  process.stdout.write(`${output}\n`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
