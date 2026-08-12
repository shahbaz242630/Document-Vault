const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const migration = fs.readFileSync(path.resolve(__dirname,
  "../supabase/migrations/20260804190000_claimant_registered_recipient_lifecycle.sql"), "utf8");

test("creates default-deny recipient grants containing ciphertext only", () => {
  assert.match(migration, /create table public\.claimant_recipient_grants/);
  assert.match(migration, /alter table public\.claimant_recipient_grants force row level security/);
  assert.match(migration, /revoke all on table public\.claimant_recipient_grants from authenticated/);
  assert.match(migration, /ciphertext text not null/);
  assert.doesNotMatch(migration, /\bmek\b|private_key|private_scalar/);
});

test("requires two active keys and invalidates grants after key change", () => {
  assert.match(migration, /create table public\.claimant_case_device_keys/);
  assert.match(migration, /unique \(key_id\)/);
  assert.match(migration, /create trigger bind_claimant_case_initial_key_after_insert/);
  assert.match(migration, /v_active_keys < 2/);
  assert.match(migration, /jsonb_array_length\(p_grants\) <> v_active_keys/);
  assert.match(migration, /update public\.claimant_recipient_grants set status = 'revoked'/);
  assert.match(migration, /owner_finalized_at = null/);
  assert.match(migration, /The last active device key cannot be revoked/);
});

test("keeps lifecycle functions service-role-only and idempotent", () => {
  assert.match(migration, /security invoker/);
  assert.doesNotMatch(migration, /security definer/);
  assert.match(migration, /revoke all on function public\.claimant_manage_registered_recipient/);
  assert.match(migration, /grant execute on function public\.claimant_manage_registered_recipient/);
  assert.match(migration, /claimant_idempotency_records/);
  assert.match(migration, /pg_advisory_xact_lock/);
});
