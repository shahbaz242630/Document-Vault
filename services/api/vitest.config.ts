import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/**/*.test.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        branches: 52,
        functions: 52,
        lines: 64,
        statements: 64,
        "src/{account-deletion,audit-retention,security}/**": {
          branches: 50,
          functions: 50,
          lines: 58,
          statements: 58,
        },
      },
    },
  },
});
