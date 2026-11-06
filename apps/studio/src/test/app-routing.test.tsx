import { readFileSync } from "node:fs";
import path from "node:path";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { NAV } from "@/lib/atlas/nav";

const ROUTES = [
  "/",
  "/studio",
  "/demo",
  "/explorer",
  "/decode",
  "/events",
  "/transactions",
  "/docs",
  "/status",
  "/developers",
  "/integrations",
  "/settings",
] as const;

function match(path: string) {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  return router.matchRoutes(path);
}

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("rewrites each Studio deep link to the Vercel entry point", () => {
    const config = JSON.parse(readFileSync(path.resolve("vercel.json"), "utf8")) as {
      rewrites: { source: string; destination: string }[];
    };
    expect(config.rewrites).toEqual(
      ROUTES.map((source) => ({ source, destination: "/index.html" })),
    );
  });

  it("matches a page for / instead of falling back to not found", () => {
    expect(match("/").at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches public landing, guided demo, and all ten Studio routes", () => {
    const destinations = NAV.map((entry) => entry.¶»§q«^