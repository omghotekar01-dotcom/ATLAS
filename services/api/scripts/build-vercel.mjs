import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run build:vercel through pnpm.");
const root = fileURLToPath(new URL("../../../", import.meta.url));

for (const filter of ["@atlas/api...", "@atlas/studio..."]) {
  execFileSync(process.execPath, [pnpm, "--filter", filter, "run", "build"], {
    cwd: root,
    env: { ...process.env, VITE_ATLAS_API_URL: "same-origin" },
    stdio: "inherit",
  });
}

const dist = fileURLToPath(new URL("../../../apps/studio/dist/", import.meta.url));
const assets = {};
for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const file = join(entry.parentPath, entry.name);
  const key = relative(dist, file).split(sep).join("/");
  assets[key] = (await readFile(file)).toString("base64");
}
if (!assets["index.html"]) throw new Error("Studio build did not produce index.html.");
await writeFile(new URL("../studio-bundle.json", import.meta.url), JSON.stringify(assets));
