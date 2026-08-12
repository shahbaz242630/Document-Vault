const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(
  path.resolve(__dirname, "../supabase/migrations/20260804170000_claimant_session_assurance.sql"),
  "utf8",
);

test("creates default-deny session controls and append-only security events", () => {
  for (const table of ["claimant_session_controls", "claimant_session_events"]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from authenticated`));
  }
  assert.doesNotMatch(migration, /grant delete on table public\.claimant_session_events/);
  assert.match(migration, /not \(metadata \?\| array\['token', 'email', 'address', 'recovery_secret'\]\)/);
});

test("keeps every session function security-invoker and service-role-only", () => {
  for (const name of [
    "claimant_activate_session",
    "claimant_assert_active_session",
    "claimant_revoke_session",
  ]) {
    assert.match(migration, new RegExp(`create function public\\.${name}`));
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\(`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\(`));
  }
  assert.doesNotMatch(migration, /security definer/);
});

test("enforces freshness, displacement, revocation, and idempotency transactionally", () => {
  assert.match(migration, /p_authenticated_at < now\(\) - interval '10 minutes'/);
  assert.match(migration, /v_control\.active_session_id <> p_session_id/);
  assert.match(migration, /status = 'revoked', revoked_at = now\(\)/);
  assert.match(migration, /operation = 'activate_claimant_session'/);
  assert.match(migration, /operation = 'revoke_claimant_session'/);
  assert.match(migration, /pg_advisory_xact_lock/);
});
