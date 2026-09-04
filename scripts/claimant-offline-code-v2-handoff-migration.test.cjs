const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260903075258_claimant_offline_code_v2_authenticated_handoff.sql"), "utf8");
const service = readFileSync(join(root,
  "services/api/src/claimant/offline-code-v2-handoff-service.ts"), "utf8");
const controller = readFileSync(join(root,
  "services/api/src/claimant/offline-code-v2-handoff-controller.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("creates a two-minute service-only authenticated handoff", () => {
  assert.match(migration, /create table public\.claimant_offline_code_v2_handoffs/u);
  assert.match(migration, /expires_at <= issued_at \+ interval '2 minutes'/u);
  assert.match(migration, /create function public\.claimant_offline_code_v2_handoff\([\s\S]*security invoker/u);
  assert.match(migration, /revoke all on function public\.claimant_offline_code_v2_handoff\([\s\S]*from public, anon, authenticated/u);
  assert.match(migration, /grant execute on function public\.claimant_offline_code_v2_handoff\([\s\S]*to service_role/u);
});

test("server-selects case and binds exact claimant, AAL2 session, proof, and transcript", () => {
  for (const token of ["v_handoff.case_id := gen_random_uuid()", "v_session.assurance_level <> 'aal2'",
    "v_handoff.portal_session_version <> v_session.version", "v_proof.status <> 'verified'",
    "p_verified_transcript_digest <> v_handoff.transcript_digest",
    "authenticated_case_handoff", "authenticated-handoff:v1"])
    assert.ok(migration.includes(token), token);
});

test("returns possession-only draft authority and remains literal-false and unmounted", () => {
  for (const token of ["'authority', 'route_possession_only'", "'identity_verified', false",
    "'claim_created', false", "'release_authorized', false"])
    assert.ok(migration.includes(token), token);
  assert.match(service, /CLAIMANT_OFFLINE_CODE_V2_HANDOFF_APPROVED = false as const/u);
  assert.match(controller, /CLAIMANT_OFFLINE_CODE_V2_HANDOFF_CONTROLLER_APPROVED = false as const/u);
  assert.equal(index.includes("offline-code-v2-handoff"), false);
});

test("stores no private proof or release material", () => {
  for (const forbidden of ["proof_private_key", "client_secret", "plaintext_mek", "root_secret",
    "wrap_key", "raw_locator", "normalized_locator"])
    assert.equal(migration.includes(forbidden) || service.includes(forbidden), false, forbidden);
});
