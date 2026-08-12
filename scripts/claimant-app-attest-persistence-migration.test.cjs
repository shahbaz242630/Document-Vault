const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(
  path.resolve(__dirname, "../supabase/migrations/20260812130000_claimant_app_attest_persistence.sql"),
  "utf8",
);

test("creates forced-RLS App Attest key and append-only event tables", () => {
  for (const table of ["claimant_app_attest_keys", "claimant_app_attest_events"]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from authenticated`));
  }
  assert.match(migration, /grant select, insert, update on table public\.claimant_app_attest_keys to service_role/);
  assert.match(migration, /grant select, insert on table public\.claimant_app_attest_events to service_role/);
  assert.doesNotMatch(migration, /grant .* on table .* to authenticated/);
});

test("keeps registration and compare-and-advance mutations service-only", () => {
  for (const name of ["claimant_register_app_attest_key", "claimant_advance_app_attest_assertion"]) {
    assert.match(migration, new RegExp(`create function public\\.${name}`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\(`));
  }
  assert.match(migration, /claimant_assert_portal_session\(p_claimant_user_id, p_portal_session_id\)/);
  assert.match(migration, /v_key\.assertion_counter <> p_expected_previous_counter/);
  assert.match(migration, /p_verified_counter <= v_key\.assertion_counter/);
  assert.match(migration, /for update;/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.doesNotMatch(migration, /security definer/);
});

test("bounds receipts, counters, extensions, and event metadata", () => {
  assert.match(migration, /octet_length\(attestation_receipt\) between 1 and 32768/);
  assert.match(migration, /assertion_counter between 0 and 4294967295/);
  assert.match(migration, /attested_validation_category in \(2, 3, 4\)/);
  for (const prohibited of ["receipt", "public_key", "attestation", "assertion", "challenge", "token", "email", "address"]) {
    assert.match(migration, new RegExp(`'${prohibited}'`));
  }
});
