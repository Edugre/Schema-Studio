import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@schema-studio/core": path.resolve(rootDir, "../../packages/core/src/index.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
