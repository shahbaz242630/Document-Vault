const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname,
  "../supabase/migrations/20260812190000_claimant_native_enrollment_reconciliation.sql"), "utf8");

test("serializes reconciliation against acceptance before terminal cleanup", () => {
  assert.match(migration, /claimant_reconcile_native_enrollment/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended/);
  assert.match(migration, /for update/);
  assert.match(migration, /operation = 'accept_native_enrollment'/);
  assert.match(migration, /v_native\.portal_session_id <> v_app\.portal_session_id/);
  assert.match(migration, /return jsonb_build_object\('status', 'committed'/);
  assert.match(migration, /set status = 'expired'/);
  assert.match(migration, /return jsonb_build_object\('status', 'not_committed'\)/);
});

test("keeps reconciliation service-only and independently throttled", () => {
  assert.match(migration, /'native_reconcile'/);
  assert.match(migration, /when 'native_reconcile' then 20/);
  assert.match(migration, /revoke all on function public\.claimant_reconcile_native_enrollment/);
  assert.match(migration, /grant execute on function public\.claimant_reconcile_native_enrollment/);
  assert.doesNotMatch(migration, /security definer/i);
  assert.doesNotMatch(migration, /grant execute .* to (?:anon|authenticated)/i);
});
