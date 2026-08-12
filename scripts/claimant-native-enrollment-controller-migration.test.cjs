const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname,
  "../supabase/migrations/20260812170000_claimant_native_enrollment_controller_authority.sql"), "utf8");

test("creates a forced-RLS server-only fixed-window limiter", () => {
  assert.match(migration, /create table public\.claimant_native_enrollment_rate_limits/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /from authenticated/);
  assert.match(migration, /date_bin\(interval '15 minutes'/);
  assert.match(migration, /when 'registration_issue' then 5/);
  assert.match(migration, /when 'native_complete' then 10/);
  assert.doesNotMatch(migration, /grant .* on table .* to authenticated/);
});

test("derives native authority from active portal, eligibility, invitation, address, and App Attest key", () => {
  assert.match(migration, /claimant_assert_portal_session\(p_claimant_user_id, p_portal_session_id\)/);
  assert.match(migration, /status = 'eligible' and source = 'synthetic_fixture'/);
  assert.match(migration, /recipient_address_digest = p_recipient_address_digest/);
  assert.match(migration, /owner_user_id <> p_claimant_user_id/);
  assert.match(migration, /app_attest_key_id_digest = p_app_attest_key_id_digest and status = 'active'/);
  for (const name of ["claimant_take_native_enrollment_rate_limit", "claimant_get_native_enrollment_authority"]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}`));
  }
  assert.doesNotMatch(migration, /security definer/);
});
