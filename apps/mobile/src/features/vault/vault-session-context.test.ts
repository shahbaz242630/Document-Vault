import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("VaultSessionProvider auth handoff", () => {
  it("does not load remote assets during cached-key startup restore", () => {
    const source = readFileSync(
      resolve(__dirname, "vault-session-context.tsx"),
      "utf8",
    );

    expect(source).toContain(
      "initialize: (keyBase64: string, client?: SupabaseVaultClient) => Promise<void>;",
    );
    expect(source).toContain("repository: createOptionalVaultRepository(client)");
    expect(source).not.toContain(
      "if (storedMek) {\n        await newSession.loadPersistedAssets();\n      }",
    );
  });

  it("does not create an unauthenticated Supabase repository for biometric cached-key unlock", () => {
    const source = readFileSync(
      resolve(__dirname, "vault-session-context.tsx"),
      "utf8",
    );

    expect(source).toContain("if (!existingClient) {");
    expect(source).not.toContain("existingClient ?? createSupabaseClient()");
  });
});
