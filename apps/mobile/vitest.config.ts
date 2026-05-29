import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url).href),
    },
  },
  test: {
    globals: false,
    testTimeout: 30_000,
  },
});
