import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("Supabase Phase 1 schema migration", () => {
  it("keeps local Supabase config aligned with Sanduqkin MFA needs", () => {
    const config = readSupabaseConfig();

    expect(config).toContain('project_id = "sanduqkin"');
    expect(config).toContain("[auth.mfa.totp]");
    expect(config).toContain("enroll_enabled = true");
    expect(config).toContain("verify_enabled = true");
  });

  it("defines encrypted vault tables with authenticated grants and RLS policies", () => {
    const migration = readPhase1Migration();

    expect(migration).toContain("create table public.vault_key_material");
    expect(migration).toContain("create table public.vault_assets");
    expect(migration).toContain("create table public.audit_events");
    expect(migration).toContain("wrapped_mek_ciphertext text not null");
    expect(migration).toContain("ciphertext text not null");
    expect(migration).toContain("nonce text not null");
    expect(migration).not.toContain("title text");
    expect(migration).not.toContain("fields jsonb");
    expect(migration).not.toContain("notes text");

    for (const table of ["vault_key_material", "vault_assets", "audit_events"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`grant all on table public.${table} to service_role`);
    }

    expect(migration).toContain(
      "grant select, insert, update on table public.vault_key_material to authenticated",
    );
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.vault_assets to authenticated",
    );
    expect(migration).toContain(
      "grant select, insert on table public.audit_events to authenticated",
    );
    expect(migration).toContain("(select auth.uid()) = user_id");
  });

  it("hardens Phase 1 table grants so anon has no direct vault table access", () => {
    const migrations = readAllMigrations();

    for (const table of ["vault_key_material", "vault_assets", "audit_events"]) {
      expect(migrations).toContain(`revoke all on table public.${table} from anon`);
      expect(migrations).toContain(`revoke all on table public.${table} from public`);
    }

    expect(migrations).toContain(
      "grant select, insert, update on table public.vault_key_material to authenticated",
    );
    expect(migrations).toContain(
      "grant select, insert, update, delete on table public.vault_assets to authenticated",
    );
    expect(migrations).toContain(
      "grant select, insert on table public.audit_events to authenticated",
    );
  });

  it("allows durable audit rows for biometric preference changes", () => {
    const migrations = readAllMigrations();

    expect(migrations).toContain("'biometric_unlock_enabled'");
    expect(migrations).toContain("'biometric_unlock_disabled'");
  });
});

function readPhase1Migration(): string {
  const migrationsDir = path.resolve(
    process.cwd(),
    "../../supabase/migrations",
  );
  const filename = readdirSync(migrationsDir).find((file) =>
    file.endsWith("_phase1_secure_data_foundation.sql"),
  );

  if (!filename) {
    throw new Error("Phase 1 Supabase migration was not found.");
  }

  return readFileSync(path.join(migrationsDir, filename), "utf8");
}

function readSupabaseConfig(): string {
  return readFileSync(
    path.resolve(process.cwd(), "../../supabase/config.toml"),
    "utf8",
  );
}

function readAllMigrations(): string {
  const migrationsDir = path.resolve(
    process.cwd(),
    "../../supabase/migrations",
  );

  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
    .join("\n");
}
