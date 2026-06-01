import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const mobileRoot = resolve(__dirname, "../../..");

describe("durable audit wiring", () => {
  it("configures durable audit after password auth receives a Supabase client", () => {
    const source = readFileSync(
      resolve(mobileRoot, "src/features/auth/components/email-password-auth-form.tsx"),
      "utf8",
    );

    expect(source).toContain("configureDurableAuditLog({");
    expect(source).toContain("auditLog: defaultAuditLog");
    expect(source).toContain("client: supabaseClient as unknown as SupabaseAuditClient");
  });

  it("configures durable audit for biometric cold-start unlock", () => {
    const source = readFileSync(
      resolve(mobileRoot, "src/features/auth/components/app-lock-overlay.tsx"),
      "utf8",
    );

    expect(source).toContain("configureDurableAuditLog({");
    expect(source).toContain("createSupabaseClient()");
  });

  it("records biometric preference changes as sensitive audit events", () => {
    const source = readFileSync(
      resolve(mobileRoot, "src/features/auth/components/biometric-preferences-panel.tsx"),
      "utf8",
    );

    expect(source).toContain('eventType: "biometric_unlock_enabled"');
    expect(source).toContain('eventType: "biometric_unlock_disabled"');
  });
});
