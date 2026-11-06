import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { NAV } from "@/lib/atlas/nav";

const ROUTES = [
  "/",
  "/explorer",
  "/decode",
  "/events",
  "/transactions",
  "/docs",
  "/status",
] as const;

function match(path: string) {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  return router.matchRoutes(path);
}

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    expect(match("/").at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("keeps all seven PRD routes and navigation entries", () => {
    expect(NAV.map((entry) => entry.to)).toEqual(ROUTES);

    for (const path of ROUTES) {
      const matches = match(path);
      expect(matches.at(-1)?.routeId, path).toBe(path === "/" ? "/" : path);
      expect(
        matches.some((entry) => entry.routeId === rootRouteId),
        path,
      ).toBe(true);
    }
  });
});
