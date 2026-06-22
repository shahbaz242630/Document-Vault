import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url).href),
    },
  },
  test: {
    coverage: {
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.native.{ts,tsx}", "src/types/**"],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        branches: 32,
        functions: 44,
        lines: 45,
        statements: 44,
        "src/features/auth/**": {
          branches: 31,
          functions: 35,
          lines: 40,
          statements: 38,
        },
        "src/features/vault/{asset-payload,emergency-access-code,emergency-key-wrapping,encrypted-storage-preview,permanent-delete-confirmation,sealed-emergency-code-service,supabase-emergency-grant-repository,supabase-key-material-repository,supabase-vault-codec,supabase-vault-repository,vault-session,vault-session-context,vault-store}.{ts,tsx}": {
          branches: 50,
          functions: 68,
          lines: 58,
          statements: 58,
        },
        "src/shared/crypto/**": {
          branches: 94,
          functions: 100,
          lines: 98,
          statements: 98,
        },
      },
    },
    globals: false,
    testTimeout: 30_000,
  },
});
