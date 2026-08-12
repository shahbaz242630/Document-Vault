const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(
  path.resolve(__dirname, "../supabase/migrations/20260804210000_claimant_portal_session_boundary.sql"),
  "utf8",
);

test("creates default-deny claimant portal eligibility and context-bound sessions", () => {
  for (const table of [
    "claimant_portal_eligibilities", "claimant_portal_session_controls",
    "claimant_portal_session_events",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
  }
  assert.match(migration, /source text not null check \(source = 'synthetic_fixture'\)/);
  assert.match(migration, /status <> 'eligible'/);
  assert.doesNotMatch(migration, /grant .* to authenticated/);
});

test("keeps portal functions service-only and separate from Phase 1 session authority", () => {
  for (const name of [
    "claimant_activate_portal_session", "claimant_assert_portal_session",
    "claimant_revoke_portal_session",
  ]) {
    assert.match(migration, new RegExp(`create function public\\.${name}`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\(`));
  }
  assert.match(migration, /'context', 'claimant_portal'/);
  assert.match(migration, /claimant:portal-session:/);
  assert.doesNotMatch(migration, /security definer/);
});

test("binds activation to eligibility version, freshness, displacement, and idempotency", () => {
  assert.match(migration, /v_eligibility\.version::text/);
  assert.match(migration, /p_authenticated_at < now\(\) - interval '10 minutes'/);
  assert.match(migration, /v_control\.active_session_id <> p_session_id/);
  assert.match(migration, /operation = 'activate_claimant_portal_session'/);
  assert.match(migration, /operation = 'revoke_claimant_portal_session'/);
});
