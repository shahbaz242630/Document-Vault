const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

const migration = readFileSync(
  "supabase/migrations/20260804150000_claimant_registered_recipient_mutations.sql",
  "utf8",
);

const serverOnlyTables = [
  "claimant_idempotency_records",
  "claimant_audit_events",
  "claimant_outbox",
];

const serverOnlyFunctions = [
  "claimant_issue_registered_invitation",
  "claimant_accept_registered_invitation",
];

test("creates default-deny idempotency, audit, and outbox tables", () => {
  for (const table of serverOnlyTables) {
    assert.match(migration, new RegExp(`create table public\\.${table}\\b`, "u"));
    assert.match(
      migration,
      new RegExp(`revoke all on table public\\.${table} from authenticated`, "u"),
    );
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} force row level security`, "u"),
    );
  }

  assert.equal((migration.match(/using \(false\)/gu) ?? []).length, serverOnlyTables.length);
  assert.equal((migration.match(/with check \(false\)/gu) ?? []).length, serverOnlyTables.length);
  assert.doesNotMatch(migration, /grant all on table public\.claimant_/iu);
  assert.match(
    migration,
    /grant select, insert on table public\.claimant_audit_events to service_role/iu,
  );
  assert.match(
    migration,
    /grant select, insert, update on table public\.claimant_outbox to service_role/iu,
  );
});

test("keeps mutation functions security-invoker and service-role-only", () => {
  for (const functionName of serverOnlyFunctions) {
    assert.match(migration, new RegExp(`create function public\\.${functionName}\\(`, "u"));
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${functionName}\\([\\s\\S]+from public, anon, authenticated`, "iu"),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${functionName}\\([\\s\\S]+to service_role`, "iu"),
    );
  }

  assert.equal((migration.match(/security invoker/gu) ?? []).length, serverOnlyFunctions.length);
  assert.equal((migration.match(/set search_path = ''/gu) ?? []).length, serverOnlyFunctions.length);
  assert.doesNotMatch(migration, /security definer/iu);
  assert.match(
    migration,
    /revoke all on function public\.enforce_vault_assets_active_record_limit\(\)[\s\S]+from public, anon, authenticated/iu,
  );
});

test("binds idempotency, stale-version, audit, and outbox writes into each transaction", () => {
  assert.equal((migration.match(/pg_advisory_xact_lock/gu) ?? []).length, serverOnlyFunctions.length);
  assert.match(migration, /Idempotency key was already used with different invitation input/u);
  assert.match(migration, /Idempotency key was already used with different acceptance input/u);
  assert.match(migration, /invitation version is stale/u);
  assert.match(migration, /for update/iu);
  assert.match(migration, /registered_invitation_issued/u);
  assert.match(migration, /registered_invitation_accepted/u);
  assert.match(migration, /claimant_key_enrolled/u);
  assert.match(migration, /claim_draft_created/u);
  assert.match(migration, /registered_recipient_case_created/u);
});

test("keeps outbox payloads value-free", () => {
  const payloadWrites = [...migration.matchAll(/jsonb_build_object\('event', '([^']+)'\)/gu)].map(
    (match) => match[1],
  );
  assert.deepEqual(payloadWrites, [
    "registered_invitation_issued",
    "registered_recipient_case_created",
  ]);
  assert.doesNotMatch(migration, /jsonb_build_object\([^;]*(?:recipient_address_digest|public_key_jwk)/iu);
});
