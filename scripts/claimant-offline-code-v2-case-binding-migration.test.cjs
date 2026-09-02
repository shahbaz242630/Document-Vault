const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260902180000_claimant_offline_code_v2_case_binding.sql"), "utf8");
const service = readFileSync(join(root,
  "services/api/src/claimant/offline-code-v2-case-binding-service.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("adds one service-only post-possession case-binding transaction", () => {
  assert.match(migration,
    /create function public\.claimant_bind_offline_code_v2_case\([\s\S]*security invoker/u);
  assert.match(migration,
    /revoke all on function public\.claimant_bind_offline_code_v2_case\([\s\S]*from public, anon, authenticated/u);
  assert.match(migration,
    /grant execute on function public\.claimant_bind_offline_code_v2_case\([\s\S]*to service_role/u);
});

test("requires fresh portal AAL2 and recent verified possession", () => {
  for (const token of ["v_session.assurance_level <> 'aal2'",
    "v_session.active_session_id <> p_portal_session_id",
    "v_session.authenticated_at < now() - interval '10 minutes'",
    "v_challenge.status <> 'verified'",
    "v_challenge.terminal_at < now() - interval '5 minutes'",
    "v_locator.status <> 'active'", "v_locator.owner_user_id = p_claimant_user_id"])
    assert.ok(migration.includes(token), token);
});

test("enforces a route-specific one-locator one-challenge case binding", () => {
  for (const token of ["route_profile in ('registered_recipient_v1', 'offline_code_v2')",
    "claimant_cases_route_binding_check", "offline_code_v2_locator_version = 2",
    "offline_code_v2_proof_key_version = 1",
    "claimant_cases_offline_locator_unique", "claimant_cases_offline_challenge_unique"])
    assert.ok(migration.includes(token), token);
  assert.match(migration, /if new\.route_profile = 'registered_recipient_v1'/u);
});

test("returns case creation without identity, intake, review, or release authority", () => {
  for (const token of ["'case_created', true", "'identity_verified', false",
    "'relationship_verified', false", "'intake_started', false",
    "'review_started', false", "'release_authorized', false"])
    assert.ok(migration.includes(token), token);
});

test("remains literal-false and unmounted", () => {
  assert.match(service,
    /CLAIMANT_OFFLINE_CODE_V2_CASE_BINDING_APPROVED = false as const/u);
  assert.equal(index.includes("offline-code-v2-case-binding-service"), false);
  assert.equal(index.includes("offline-code-v2-case-binding-transaction-client"), false);
});

test("contains no complete secret or private release material", () => {
  for (const forbidden of ["client_secret", "proof_private_key", "plaintext_mek",
    "root_secret", "wrap_key", "raw_locator", "normalized_locator"])
    assert.equal(migration.includes(forbidden), false, forbidden);
});
