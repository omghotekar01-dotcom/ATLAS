import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@atlas/arkiv": path.resolve(root, "../packages/arkiv/src/index.ts"),
      "@atlas/schemas": path.resolve(root, "../packages/schemas/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
