const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260818210000_claimant_retrieval_session_foundation.sql"), "utf8");
const service = readFileSync(join(root,
  "services/api/src/claimant/retrieval-session-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/retrieval-session-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("creates three forced-RLS retrieval-session tables", () => {
  for (const table of ["claimant_release_retrieval_sessions",
    "claimant_release_retrieval_session_events",
    "claimant_release_retrieval_session_idempotency"])
    assert.ok(migration.includes(`create table public.${table}`), table);
  assert.equal((migration.match(/force row level security/g) ?? []).length, 3);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 3);
});
test("binds verified fresh AAL2 and the active claimant portal context", () => {
  for (const token of ["v_identity.status <> 'active'",
    "eligibility.status = 'eligible'", "v_portal.status <> 'active'",
    "v_portal.active_session_id <> p_portal_session_id",
    "v_portal.assurance_level <> 'aal2'",
    "v_portal.authenticated_at <> p_authenticated_at",
    "p_authenticated_at < v_authorized_at - interval '10 minutes'"])
    assert.ok(migration.includes(token), token);
  assert.match(service, /requireFreshClaimantAssurance\(session/u);
  assert.match(service, /claimantUserId: session\.userId/u);
  assert.match(service, /portalSessionId: session\.sessionId/u);
});
test("revalidates exact release-ready finalization, manifest, grant, and key", () => {
  for (const token of ["v_case.state <> 'release_ready'",
    "v_finalization.finalized_case_version <> p_expected_case_version",
    "v_finalization.status <> 'finalized_release_ready'",
    "v_manifest.signing_key_id <> v_finalization.signing_key_id",
    "v_source_grant.status <> 'active'", "v_device_key.status <> 'active'",
    "v_case_key.status <> 'active'", "signing_key.status <> 'compromised'",
    "from public.claimant_review_interventions intervention"])
    assert.ok(migration.includes(token), token);
});
test("issues only a fifteen-minute single-purpose unserved authorization", () => {
  assert.match(migration, /purpose = 'single_package_retrieval'/u);
  assert.match(migration, /status = 'authorized_unserved'/u);
  assert.match(migration, /expires_at <= authorized_at \+ interval '15 minutes'/u);
  assert.match(migration, /v_authorized_at \+ interval '15 minutes'/u);
  for (const token of ["package_serving_authorized boolean not null default false",
    "package_served boolean not null default false",
    "retrieval_completed boolean not null default false"])
    assert.ok(migration.includes(token), token);
  assert.doesNotMatch(migration, /state = 'released'/u);
  assert.doesNotMatch(migration, /update public\.claimant_cases/u);
});
test("uses service-only security-invoker RPC, indexes, and stays unmounted", () => {
  assert.match(migration, /language plpgsql[\s\S]*security invoker[\s\S]*set search_path = ''/u);
  assert.match(migration,
    /revoke all on function public\.claimant_authorize_release_retrieval_session\([\s\S]*from public, anon, authenticated;/u);
  assert.ok((migration.match(/create index claimant_release_retrieval_/g) ?? []).length >= 8);
  assert.equal(index.includes("retrieval-session-service"), false);
  assert.match(service, /CLAIMANT_RETRIEVAL_SESSION_APPROVED = false as const/u);
});
test("returns no package, manifest, signature, token, URL, or ciphertext", () => {
  const result = migration.slice(migration.indexOf("v_result := jsonb_build_object"),
    migration.indexOf("insert into public.claimant_release_retrieval_session_idempotency"));
  for (const token of ["ciphertext", "nonce", "canonical_manifest", "detached_signature",
    "public_key", "token", "signed_url", "owner_user_id"])
    assert.equal(result.includes(`'${token}'`), false, token);
  assert.match(client, /package_serving_authorized: z\.literal\(false\)/u);
  assert.match(client, /package_served: z\.literal\(false\)/u);
  assert.match(client, /retrieval_completed: z\.literal\(false\)/u);
});
