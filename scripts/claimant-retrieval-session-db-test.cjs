const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { standaloneSchema: signedManifestSchema } =
  require("./claimant-signed-manifest-db-test.cjs");
const { buildClaimantEncryptedPackageDbTestSql } =
  require("./claimant-encrypted-package-db-test.cjs");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const migration = readFileSync(join(__dirname,
  "../supabase/migrations/20260818210000_claimant_retrieval_session_foundation.sql"),
"utf8");
function standaloneSchema() { return `${signedManifestSchema()}
alter table public.claimant_identities add column status text not null default 'active';
alter table public.claimant_device_keys
  add unique (id, claimant_user_id);
create table public.claimant_portal_eligibilities(user_id uuid primary key,
  status text not null, source text not null);
create table public.claimant_portal_session_controls(user_id uuid primary key,
  active_session_id uuid not null, status text not null, assurance_level text not null,
  authenticated_at timestamptz not null, version integer not null);
grant all on public.claimant_portal_eligibilities,
  public.claimant_portal_session_controls to service_role;
${migration}`; }

function buildClaimantRetrievalSessionDbTestSql(options = {}) {
  const names = ["case", "cycle", "round", "authorization", "releaseAuthority",
    "releaseAuthorityUser", "signingAuthority", "signingUser", "signingKey", "owner",
    "claimant", "portalSession", "wrongPortalSession", "key1", "key2", "grant1",
    "grant2", "package", "finalization", "manifest1", "manifest2", "retrieval",
    "changedRetrieval", "first", "hostile", "intervention"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  const authenticatedAt = new Date(Date.now() - 60_000).toISOString();
  const standaloneFixture = `insert into auth.users(id) values ('${id.owner}'), ('${id.claimant}'),
  ('${id.releaseAuthorityUser}'), ('${id.signingUser}');
insert into public.claimant_identities(user_id, status) values ('${id.claimant}', 'active');
insert into public.claimant_cases (id, claimant_user_id, owner_user_id, state, version,
  route_profile, policy_pack_id, policy_pack_version, updated_at) values
  ('${id.case}', '${id.claimant}', '${id.owner}', 'release_ready', 7,
  'registered_recipient_v1', 'synthetic_policy_death_alpha', 1, now());
insert into public.claimant_owner_protection_cycles
  (id, case_id, owner_user_id, claimant_user_id, status, cooldown_expires_at, cycle_number)
values ('${id.cycle}', '${id.case}', '${id.owner}', '${id.claimant}',
  'delivery_verified', now() - interval '1 day', 1);
insert into public.claimant_review_rounds values
  ('${id.round}', '${id.case}', 'two_person_approved', 2, true, false);
insert into public.claimant_release_authority_identities
  (id, status, synthetic_only, live_release_authority, user_id) values
  ('${id.releaseAuthority}', 'active', true, false, '${id.releaseAuthorityUser}');
insert into public.claimant_release_authorizations values ('${id.authorization}',
  '${id.case}', '${id.cycle}', '${id.round}', '${id.releaseAuthority}', 6, 'authorized',
  true, false, false, 'synthetic_policy_death_alpha', 1, 2);
insert into public.claimant_device_keys values
  ('${id.key1}', '${id.claimant}', 'active', 1),
  ('${id.key2}', '${id.claimant}', 'active', 1);
insert into public.claimant_case_device_keys values
  ('${id.case}', '${id.key1}', '${id.claimant}', 'active'),
  ('${id.case}', '${id.key2}', '${id.claimant}', 'active');
insert into public.claimant_recipient_grants values
  ('${id.grant1}', '${id.case}', '${id.owner}', '${id.claimant}', '${id.key1}', 1,
    'sanduqkin:claim:recipient-grant:v1', 'registered_recipient_v2', 'X25519',
    'HKDF-SHA256', 'XChaCha20-Poly1305', 'ephemeral_1', 'nonce_1', 'cipher_1', 1, 'active'),
  ('${id.grant2}', '${id.case}', '${id.owner}', '${id.claimant}', '${id.key2}', 1,
    'sanduqkin:claim:recipient-grant:v1', 'registered_recipient_v2', 'X25519',
    'HKDF-SHA256', 'XChaCha20-Poly1305', 'ephemeral_2', 'nonce_2', 'cipher_2', 1, 'active');`;
  const liveFixture = buildClaimantEncryptedPackageDbTestSql({ fixtureOnly: true,
    ids: { ...id, authority: id.releaseAuthority, authorityUser: id.releaseAuthorityUser } })
    + `insert into auth.users(id) values ('${id.signingUser}');
      update public.claimant_cases set state = 'release_ready', version = 7 where id = '${id.case}';`;
  const interventionInsert = options.standalone
    ? `insert into public.claimant_review_interventions values ('${id.intervention}', '${id.case}');`
    : `insert into public.claimant_review_interventions(id, case_id, cycle_id, review_round_id,
        authority_identity_id, intervention_type, reason_class, source_review_status,
        source_round_version) values ('${id.intervention}', '${id.case}', '${id.cycle}',
        '${id.round}', '${id.releaseAuthority}', 'escalation', 'policy_review_required',
        'two_person_approved', 2);`;
  return `begin;
${options.standalone ? standaloneSchema() + standaloneFixture : liveFixture}
insert into public.claimant_portal_eligibilities(user_id, status, source)
values ('${id.claimant}', 'eligible', 'synthetic_fixture');
insert into public.claimant_portal_session_controls(user_id, active_session_id, status,
  assurance_level, authenticated_at, version)
values ('${id.claimant}', '${id.portalSession}', 'active', 'aal2', '${authenticatedAt}', 2);
insert into public.claimant_release_packages (id, package_ref, case_id,
  release_authorization_id, cycle_id, review_round_id, owner_user_id, claimant_user_id,
  case_version, asset_count, grant_count, asset_snapshot_boundary,
  preparation_manifest_digest, prepared_at, expires_at) values
  ('${id.package}', 'synthetic_release_package_slice_4d', '${id.case}',
  '${id.authorization}', '${id.cycle}', '${id.round}', '${id.owner}', '${id.claimant}',
  6, 1, 2, now() - interval '1 hour', '${"a".repeat(64)}',
  now() - interval '1 hour', now() + interval '71 hours');
insert into public.claimant_release_package_grants values
  ('${id.package}', '${id.case}', 1, '${id.grant1}', 1, '${id.key1}', 1,
    '${"b".repeat(64)}', true),
  ('${id.package}', '${id.case}', 2, '${id.grant2}', 1, '${id.key2}', 1,
    '${"c".repeat(64)}', true);
insert into public.claimant_release_signing_authorities (id, user_id, pseudonymous_ref)
values ('${id.signingAuthority}', '${id.signingUser}', 'synthetic_release_signer_retrieval');
insert into public.claimant_release_signing_keys (id, authority_id, signing_key_id,
  key_version, public_key, public_key_digest, valid_from, valid_until) values
  ('${id.signingKey}', '${id.signingAuthority}', 'claim-release-signing-synthetic-v1', 1,
  '${"A".repeat(43)}', '${"d".repeat(64)}', now() - interval '1 day', now() + interval '30 days');
insert into public.claimant_release_package_finalizations (id, package_id, case_id,
  release_authorization_id, signing_authority_id, signing_key_id, source_case_version,
  finalized_case_version, preparation_manifest_digest, signed_manifest_set_digest,
  manifest_count, finalized_at, expires_at) values
  ('${id.finalization}', '${id.package}', '${id.case}', '${id.authorization}',
  '${id.signingAuthority}', '${id.signingKey}', 6, 7, '${"a".repeat(64)}',
  '${"e".repeat(64)}', 2, now() - interval '30 minutes', now() + interval '71 hours');
insert into public.claimant_release_signed_manifests (id, finalization_id, package_id,
  case_id, ordinal, grant_id, signing_key_id, canonical_manifest, manifest_digest,
  detached_signature, signature_verified_at) values
  ('${id.manifest1}', '${id.finalization}', '${id.package}', '${id.case}', 1,
  '${id.grant1}', '${id.signingKey}', repeat('m', 256), '${"f".repeat(64)}',
  repeat('S', 86), now() - interval '30 minutes'),
  ('${id.manifest2}', '${id.finalization}', '${id.package}', '${id.case}', 2,
  '${id.grant2}', '${id.signingKey}', repeat('n', 256), '${"1".repeat(64)}',
  repeat('T', 86), now() - interval '30 minutes');
set local role service_role;
do $test$ declare v_result jsonb; begin
  begin perform public.claimant_authorize_release_retrieval_session(
    '${id.retrieval}', '${id.claimant}', '${id.wrongPortalSession}', '${authenticatedAt}',
    '${id.case}', 7, '${id.finalization}', '${id.package}', '${id.grant1}', '${id.key1}',
    '${id.hostile}'); raise exception 'wrong portal session was accepted';
  exception when invalid_authorization_specification then null; end;
  begin
    update public.claimant_portal_session_controls set
      authenticated_at = now() - interval '11 minutes' where user_id = '${id.claimant}';
    begin perform public.claimant_authorize_release_retrieval_session(
      '${id.retrieval}', '${id.claimant}', '${id.portalSession}',
      now() - interval '11 minutes', '${id.case}', 7, '${id.finalization}', '${id.package}',
      '${id.grant1}', '${id.key1}', '${id.hostile}');
      raise exception 'stale assurance was accepted';
    exception when invalid_authorization_specification then null; end;
    raise exception 'ROLLBACK_ASSURANCE' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_ASSURANCE' then raise; end if; end;
  begin
    update public.claimant_release_signing_keys set status = 'compromised'
      where id = '${id.signingKey}';
    begin perform public.claimant_authorize_release_retrieval_session(
      '${id.retrieval}', '${id.claimant}', '${id.portalSession}', '${authenticatedAt}',
      '${id.case}', 7, '${id.finalization}', '${id.package}', '${id.grant1}', '${id.key1}',
      '${id.hostile}'); raise exception 'compromised signing key was accepted';
    exception when serialization_failure then null; end;
    raise exception 'ROLLBACK_SIGNING_KEY' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_SIGNING_KEY' then raise; end if; end;
  begin
    update public.claimant_recipient_grants
    set status = 'revoked'${options.standalone ? "" : ", revoked_at = now()"}
    where id = '${id.grant1}';
    begin perform public.claimant_authorize_release_retrieval_session(
      '${id.retrieval}', '${id.claimant}', '${id.portalSession}', '${authenticatedAt}',
      '${id.case}', 7, '${id.finalization}', '${id.package}', '${id.grant1}', '${id.key1}',
      '${id.hostile}'); raise exception 'revoked grant was accepted';
    exception when serialization_failure then null; end;
    raise exception 'ROLLBACK_GRANT' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_GRANT' then raise; end if; end;
  begin
    ${interventionInsert}
    begin perform public.claimant_authorize_release_retrieval_session(
      '${id.retrieval}', '${id.claimant}', '${id.portalSession}', '${authenticatedAt}',
      '${id.case}', 7, '${id.finalization}', '${id.package}', '${id.grant1}', '${id.key1}',
      '${id.hostile}'); raise exception 'intervention was accepted';
    exception when serialization_failure then null; end;
    raise exception 'ROLLBACK_INTERVENTION' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_INTERVENTION' then raise; end if; end;
  v_result := public.claimant_authorize_release_retrieval_session(
    '${id.retrieval}', '${id.claimant}', '${id.portalSession}', '${authenticatedAt}',
    '${id.case}', 7, '${id.finalization}', '${id.package}', '${id.grant1}', '${id.key1}',
    '${id.first}');
  if v_result ->> 'case_state' <> 'release_ready'
    or not (v_result ->> 'session_authorized')::boolean
    or (v_result ->> 'package_serving_authorized')::boolean
    or (v_result ->> 'package_served')::boolean
    or (v_result ->> 'retrieval_completed')::boolean
    or (v_result ->> 'retrieval_session_status') <> 'authorized_unserved' then
    raise exception 'retrieval-session result was unsafe'; end if;
  if (v_result ->> 'retrieval_session_expires_at')::timestamptz > now() + interval '15 minutes'
    or (v_result ->> 'retrieval_session_expires_at')::timestamptz <= now() + interval '1 minute' then
    raise exception 'retrieval-session expiry was unsafe'; end if;
  if not (public.claimant_authorize_release_retrieval_session(
    '${id.retrieval}', '${id.claimant}', '${id.portalSession}', '${authenticatedAt}',
    '${id.case}', 7, '${id.finalization}', '${id.package}', '${id.grant1}', '${id.key1}',
    '${id.first}') ->> 'replayed')::boolean then
    raise exception 'retrieval-session replay was unstable'; end if;
  begin perform public.claimant_authorize_release_retrieval_session(
    '${id.changedRetrieval}', '${id.claimant}', '${id.portalSession}', '${authenticatedAt}',
    '${id.case}', 7, '${id.finalization}', '${id.package}', '${id.grant1}', '${id.key1}',
    '${id.first}'); raise exception 'changed replay was accepted';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.claimant_release_retrieval_sessions) <> 1
    or (select count(*) from public.claimant_release_retrieval_session_events) <> 1
    or (select count(*) from public.claimant_release_retrieval_session_idempotency) <> 1
    or (select state from public.claimant_cases where id = '${id.case}') <> 'release_ready'
    or (select version from public.claimant_cases where id = '${id.case}') <> 7
    or (select package_serving_authorized from public.claimant_release_retrieval_sessions)
    or (select package_served from public.claimant_release_retrieval_sessions)
    or (select retrieval_completed from public.claimant_release_retrieval_sessions) then
    raise exception 'retrieval-session atomic records failed'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_release_retrieval_sessions;
    raise exception 'authenticated role read retrieval session';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_authorize_release_retrieval_session(
    '${id.retrieval}', '${id.claimant}', '${id.portalSession}', '${authenticatedAt}',
    '${id.case}', 7, '${id.finalization}', '${id.package}', '${id.grant1}', '${id.key1}',
    '${id.hostile}'); raise exception 'authenticated role called retrieval authorization';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role; rollback;
select 'CLAIMANT_RETRIEVAL_SESSION_DB_TEST_PASSED';`;
}

function runClaimantRetrievalSessionDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildClaimantRetrievalSessionDbTestSql(options) });
  if (!output.includes("CLAIMANT_RETRIEVAL_SESSION_DB_TEST_PASSED"))
    throw new Error("Retrieval-session DB marker was missing.");
}
if (require.main === module) { runClaimantRetrievalSessionDbTest();
  console.log("Claimant retrieval-session DB test passed."); }
module.exports = { buildClaimantRetrievalSessionDbTestSql,
  runClaimantRetrievalSessionDbTest, standaloneSchema };
