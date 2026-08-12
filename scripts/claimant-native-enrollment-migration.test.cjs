const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname,
  "../supabase/migrations/20260812150000_claimant_native_enrollment_challenges.sql"), "utf8");

test("creates forced-RLS, server-only, single-use challenge tables", () => {
  for (const table of ["claimant_app_attest_challenges", "claimant_native_enrollment_challenges"]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from authenticated`));
  }
  assert.match(migration, /status text not null default 'issued' check \(status in \('issued', 'consumed', 'expired'\)\)/);
  assert.match(migration, /where purpose = 'registration' and status = 'issued'/);
  assert.match(migration, /where status = 'issued'/);
  assert.doesNotMatch(migration, /grant .* on table .* to authenticated/);
});

test("keeps every challenge and acceptance function service-role-only", () => {
  for (const name of ["claimant_issue_app_attest_registration_challenge",
    "claimant_get_app_attest_registration_challenge", "claimant_consume_app_attest_registration_challenge",
    "claimant_issue_native_enrollment_challenge", "claimant_get_native_enrollment_evidence",
    "claimant_accept_native_enrollment"]) {
    assert.match(migration, new RegExp(`create function public\\.${name}`));
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}`));
  }
  assert.doesNotMatch(migration, /security definer/);
});

test("atomically binds session, invitation, proof digests, App Attest counter, key, case, and challenge consumption", () => {
  assert.match(migration, /claimant_assert_portal_session\(p_claimant_user_id, p_portal_session_id\)/);
  assert.match(migration, /v_app_challenge\.native_enrollment_challenge_digest <> p_verified_native_challenge_digest/);
  assert.match(migration, /v_app_key\.assertion_counter <> p_expected_app_attest_counter/);
  assert.match(migration, /p_verified_app_attest_counter <= v_app_key\.assertion_counter/);
  assert.match(migration, /v_invitation\.recipient_address_digest <> v_native\.recipient_address_digest/);
  assert.match(migration, /insert into public\.claimant_device_keys/);
  assert.match(migration, /insert into public\.claimant_cases/);
  assert.match(migration, /update public\.claimant_app_attest_challenges set status = 'consumed'/);
  assert.match(migration, /update public\.claimant_native_enrollment_challenges set status = 'consumed'/);
});
