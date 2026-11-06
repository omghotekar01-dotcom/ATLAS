import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type { FastifyInstance } from "fastify";

const pages = [
  "/",
  "/explorer",
  "/decode",
  "/events",
  "/transactions",
  "/docs",
  "/status",
  "/developers",
  "/integrations",
  "/settings",
];

const contentTypes: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function loadStudio(): Record<string, string> | undefined {
  try {
    return JSON.parse(
      readFileSync(new URL("../studio-bundle.json", import.meta.url), "utf8"),
    ) as Record<string, string>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}

export function registerStudio(app: FastifyInstance, assets = loadStudio()): void {
  if (!assets) return;
  const index = Buffer.from(assets["index.html"] ?? "", "base64");
  if (!index.length) throw new Error("ATLAS Studio bundle has no index.html.");

  for (const page of pages.flatMap((path) => (path === "/" ? [path] : [path, `${path}/`]))) {
    app.get(page, async (_request, reply) =>
      reply.type("text/html; charset=utf-8").header("cache-control", "no-cache").send(index),
    );
  }

  for (const [file, bytes] of Object.entries(assets)) {
    if (!file.startsWith("assets/")) continue;
    const body = Buffer.from(bytes, "base64");
    app.get(`/${file}`, async (_request, reply) =>
      reply
        .type(contentTypes[extname(file)] ?? "application/octet-stream")
        .header("cache-control", "public, max-age=31536000, immutable")
        .send(body),
    );
  }
}
