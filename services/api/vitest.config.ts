import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@atlas/schemas": path.resolve(root, "../../packages/schemas/src/index.ts"),
      "@atlas/core": path.resolve(root, "../../packages/core/src/index.ts"),
      "@atlas/chain": path.resolve(root, "../../packages/chain/src/index.ts"),
      "@atlas/arkiv": path.resolve(root, "../../packages/arkiv/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The upstream-timeout tests intentionally wait for short timers.
    testTimeout: 10_000,
  },
});
