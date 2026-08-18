const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260818180000_claimant_release_authorization_foundation.sql"), "utf8");
const service = readFileSync(join(root,
  "services/api/src/claimant/release-authorization-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/release-authorization-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("creates four forced-RLS release-authorization tables with immutable records", () => {
  for (const table of ["claimant_release_authority_identities",
    "claimant_release_authorizations", "claimant_release_authorization_events",
    "claimant_release_authorization_idempotency"])
    assert.ok(migration.includes(`create table public.${table}`), table);
  assert.equal((migration.match(/force row level security/g) ?? []).length, 4);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 4);
  assert.doesNotMatch(migration, /grant[^;]*(update|delete)[^;]*claimant_release_authorizations/);
  assert.doesNotMatch(migration,
    /grant[^;]*(update|delete)[^;]*claimant_release_authorization_events/);
});
test("revalidates finalization, cooldown, review, intervention, policy, and key grants", () => {
  for (const token of ["v_case.owner_finalized_at is null",
    "v_cycle.cooldown_expires_at > now()", "v_round.status <> 'two_person_approved'",
    "not v_round.two_person_approval_satisfied", "v_round.policy_pack_id <> v_case.policy_pack_id",
    "from public.claimant_review_interventions intervention", "decision.decision <> 'allow'",
    "assignment.assignment_version <> decision.assignment_version",
    "reviewer.status <> 'active'", "v_active_key_count < 2",
    "v_active_grant_count <> v_active_key_count",
    "grant_record.recipient_key_version = device_key.key_version"])
    assert.ok(migration.includes(token), token);
});
test("uses a distinct synthetic authorizer and advances only cooldown to approved", () => {
  for (const token of ["synthetic_release_authority_", "live_release_authority",
    "v_authority.user_id in (v_case.owner_user_id, v_case.claimant_user_id)",
    "from public.claimant_reviewer_identities reviewer",
    "from public.claimant_review_resolution_authorities resolution"])
    assert.ok(migration.includes(token), token);
  assert.match(migration, /update public\.claimant_cases set state = 'approved'/);
  assert.match(migration, /where id = p_case_id and state = 'cooldown'/);
});
test("authorizes release but explicitly denies package creation and retrieval", () => {
  assert.match(migration, /release_authorized boolean not null default true check \(release_authorized\)/);
  assert.match(migration, /package_creation_authorized boolean not null default false/);
  assert.match(migration, /retrieval_authorized boolean not null default false/);
  assert.match(migration, /'package_creation_authorized', false/);
  assert.match(migration, /'retrieval_authorized', false/);
  for (const token of ["ciphertext", "release_package", "retrieval_session", "signed_url"])
    assert.ok(!migration.includes(token), token);
});
test("keeps the security-invoker service literal-false and unmounted", () => {
  assert.match(migration, /language plpgsql security invoker set search_path = ''/);
  assert.doesNotMatch(migration, /security definer/);
  assert.match(migration, /revoke all on function public\.claimant_authorize_release[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.claimant_authorize_release[\s\S]*to service_role/);
  assert.match(service, /CLAIMANT_RELEASE_AUTHORIZATION_APPROVED\s*=\s*false\s+as\s+const/);
  assert.doesNotMatch(index, /release-authorization-service|release-authorization-transaction-client/);
});
test("indexes foreign-key lookup paths and returns no identity or private material", () => {
  for (const indexName of ["claimant_release_authorizations_cycle_case_idx",
    "claimant_release_authorizations_authority_idx",
    "claimant_release_authorization_events_authorization_case_idx",
    "claimant_release_authorization_events_authority_idx",
    "claimant_release_authorization_idempotency_authority_idx"])
    assert.ok(migration.includes(`create index ${indexName}`), indexName);
  const resultType = client.slice(client.indexOf("export type ReleaseAuthorizationResultV1"),
    client.indexOf("export type ReleaseAuthorizationTransactionClientV1"));
  assert.doesNotMatch(resultType, /authorityIdentityId|reasonClass|reviewer|decision|ciphertext/);
});
