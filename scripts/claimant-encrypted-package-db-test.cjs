const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const migration = readFileSync(join(__dirname,
  "../supabase/migrations/20260818190000_claimant_encrypted_package_foundation.sql"),
"utf8");

function standaloneSchema() { return `
create role anon nologin; create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create schema extensions; create extension pgcrypto with schema extensions;
grant usage on schema extensions to service_role;
grant execute on all functions in schema extensions to service_role;
create table public.claimant_identities(user_id uuid primary key);
create table public.claimant_cases(id uuid primary key, claimant_user_id uuid not null,
  owner_user_id uuid not null, state text not null, version integer not null,
  route_profile text not null, policy_pack_id text not null,
  policy_pack_version integer not null);
create table public.claimant_owner_protection_cycles(id uuid primary key, case_id uuid not null,
  owner_user_id uuid not null, claimant_user_id uuid not null, status text not null,
  cooldown_expires_at timestamptz, unique(id, case_id));
create table public.claimant_review_rounds(id uuid primary key, case_id uuid not null,
  status text not null, round_version integer not null,
  two_person_approval_satisfied boolean not null, release_authorized boolean not null,
  unique(id, case_id));
create table public.claimant_release_authority_identities(id uuid primary key,
  status text not null, synthetic_only boolean not null,
  live_release_authority boolean not null);
create table public.claimant_release_authorizations(id uuid primary key, case_id uuid not null,
  cycle_id uuid not null, review_round_id uuid not null, authority_identity_id uuid not null,
  authorized_case_version integer not null, status text not null,
  release_authorized boolean not null, package_creation_authorized boolean not null,
  retrieval_authorized boolean not null, policy_pack_id text not null,
  policy_pack_version integer not null, review_round_version integer not null,
  unique(id, case_id));
create table public.claimant_review_interventions(id uuid primary key, case_id uuid not null);
create table public.claimant_device_keys(id uuid primary key, claimant_user_id uuid not null,
  status text not null, key_version integer not null);
create table public.claimant_case_device_keys(case_id uuid not null, key_id uuid not null,
  claimant_user_id uuid not null, status text not null, primary key(case_id, key_id));
create table public.claimant_recipient_grants(id uuid primary key, case_id uuid not null,
  owner_user_id uuid not null, claimant_user_id uuid not null, recipient_key_id uuid not null,
  recipient_key_version integer not null, protocol text not null, profile text not null,
  key_agreement text not null, kdf text not null, aead text not null,
  owner_ephemeral_public_key text not null, nonce text not null, ciphertext text not null,
  grant_version integer not null, status text not null);
create table public.vault_assets(id uuid primary key, user_id uuid not null,
  asset_type text not null, ciphertext text not null, nonce text not null,
  created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz);
grant all on all tables in schema public to service_role;
${migration}`; }

function buildClaimantEncryptedPackageDbTestSql(options = {}) {
  const names = ["case", "cycle", "round", "authorization", "authority", "authorityUser", "owner",
    "claimant", "key1", "key2", "grant1", "grant2", "asset", "package", "first",
    "changed", "hostile", "intervention"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  const standaloneFixture = `
insert into auth.users(id) values ('${id.owner}'), ('${id.claimant}');
insert into public.claimant_identities values ('${id.claimant}');
insert into public.claimant_cases values ('${id.case}', '${id.claimant}', '${id.owner}',
  'approved', 6, 'registered_recipient_v1', 'synthetic_policy_death_alpha', 1);
insert into public.claimant_owner_protection_cycles values ('${id.cycle}', '${id.case}',
  '${id.owner}', '${id.claimant}', 'delivery_verified', now() - interval '1 day');
insert into public.claimant_review_rounds values ('${id.round}', '${id.case}',
  'two_person_approved', 2, true, false);
insert into public.claimant_release_authority_identities values
  ('${id.authority}', 'active', true, false);
insert into public.claimant_release_authorizations values ('${id.authorization}',
  '${id.case}', '${id.cycle}', '${id.round}', '${id.authority}', 6, 'authorized',
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
    'HKDF-SHA256', 'XChaCha20-Poly1305', 'OwnerEphemeralPublicKey_00000001',
    'GrantNonce_0000000000000001', 'GrantCiphertext_00000000000000000001', 1, 'active'),
  ('${id.grant2}', '${id.case}', '${id.owner}', '${id.claimant}', '${id.key2}', 1,
    'sanduqkin:claim:recipient-grant:v1', 'registered_recipient_v2', 'X25519',
    'HKDF-SHA256', 'XChaCha20-Poly1305', 'OwnerEphemeralPublicKey_00000002',
    'GrantNonce_0000000000000002', 'GrantCiphertext_00000000000000000002', 1, 'active');`;
  const liveFixture = `
insert into auth.users(id) values ('${id.owner}'), ('${id.claimant}'), ('${id.authorityUser}');
insert into public.claimant_identities(user_id, status) values ('${id.claimant}', 'active');
insert into public.claimant_invitations(id, owner_user_id, recipient_address_digest, status,
  accepted_by_user_id, expires_at, accepted_at)
values (gen_random_uuid(), '${id.owner}', repeat('a', 64), 'accepted', '${id.claimant}',
  now() + interval '1 day', now());
insert into public.claimant_device_keys(id, claimant_user_id, device_binding_digest, public_key_jwk)
values ('${id.key1}', '${id.claimant}', repeat('b', 64),
    jsonb_build_object('kty','EC','crv','P-256','x',repeat('A',43),'y',repeat('B',43))),
  ('${id.key2}', '${id.claimant}', repeat('c', 64),
    jsonb_build_object('kty','EC','crv','P-256','x',repeat('C',43),'y',repeat('D',43)));
insert into public.claimant_cases(id, claimant_user_id, owner_user_id, invitation_id,
  current_key_id, state, policy_pack_id, policy_pack_version, version, binding_version,
  finalization_version, owner_finalized_at)
select '${id.case}', '${id.claimant}', '${id.owner}', invitation.id, '${id.key1}',
  'approved', 'synthetic_policy_death_alpha', 1, 6, 2, 1, now()
from public.claimant_invitations invitation where invitation.owner_user_id = '${id.owner}';
insert into public.claimant_submission_receipts(case_id, claimant_user_id, synthetic_only,
  submission_ref, acknowledgement_ref, submission_digest, case_version, intake_version,
  preparation_version, evidence_object_count, unavailable_item_count, status, review_started,
  release_authorized, claimed_created_at)
values ('${id.case}', '${id.claimant}', true, 'synthetic_submission_encrypted_package',
  'synthetic_acknowledgement_${"a".repeat(32)}', repeat('d', 64), 3, 9, 9, 1, 0,
  'received_for_review', false, false, now() - interval '2 days');
insert into public.claimant_owner_protection_cycles(id, case_id, owner_user_id,
  claimant_user_id, policy_pack_id, policy_pack_version, submission_case_version,
  cycle_number, notice_ref, status, cooldown_seconds, delivery_evidence_digest,
  delivery_verified_at, cooldown_started_at, cooldown_expires_at)
values ('${id.cycle}', '${id.case}', '${id.owner}', '${id.claimant}',
  'synthetic_policy_death_alpha', 1, 3, 1, 'synthetic_owner_notice_encrypted_package',
  'delivery_verified', 86400, repeat('e', 64), now() - interval '2 days',
  now() - interval '2 days', now() - interval '1 day');
insert into public.claimant_review_rounds(id, case_id, cycle_id, case_version,
  submission_case_version, intake_version, preparation_version, policy_pack_id,
  policy_pack_version, checklist_digest, evidence_manifest_digest, status, round_version,
  two_person_approval_satisfied, release_authorized, completed_at)
values ('${id.round}', '${id.case}', '${id.cycle}', 5, 3, 9, 9,
  'synthetic_policy_death_alpha', 1, repeat('f', 64), repeat('1', 64),
  'two_person_approved', 2, true, false, now());
insert into public.claimant_release_authority_identities(id, user_id, pseudonymous_ref,
  authority_class) values ('${id.authority}', '${id.authorityUser}',
  'synthetic_release_authority_encrypted_package', 'release_test_authorizer');
insert into public.claimant_release_authorizations(id, case_id, cycle_id, review_round_id,
  authority_identity_id, source_case_version, authorized_case_version, binding_version,
  finalization_version, submission_case_version, review_round_version, policy_pack_id,
  policy_pack_version)
values ('${id.authorization}', '${id.case}', '${id.cycle}', '${id.round}', '${id.authority}',
  5, 6, 2, 1, 3, 2, 'synthetic_policy_death_alpha', 1);
insert into public.claimant_case_device_keys(case_id, key_id, claimant_user_id)
values ('${id.case}', '${id.key2}', '${id.claimant}');
insert into public.claimant_recipient_grants(id, case_id, owner_user_id, claimant_user_id,
  recipient_key_id, recipient_key_version, protocol, profile, key_agreement, kdf, aead,
  owner_ephemeral_public_key, nonce, ciphertext, grant_version, status, created_at)
values ('${id.grant1}', '${id.case}', '${id.owner}', '${id.claimant}', '${id.key1}', 1,
    'sanduqkin:claim:recipient-grant:v2', 'registered_recipient_v2', 'p256_ecdh',
    'hkdf_sha256', 'xchacha20poly1305_ietf', repeat('E', 87), repeat('N', 32),
    repeat('G', 64), 1, 'active', now()),
  ('${id.grant2}', '${id.case}', '${id.owner}', '${id.claimant}', '${id.key2}', 1,
    'sanduqkin:claim:recipient-grant:v2', 'registered_recipient_v2', 'p256_ecdh',
    'hkdf_sha256', 'xchacha20poly1305_ietf', repeat('F', 87), repeat('M', 32),
    repeat('H', 64), 1, 'active', now());`;
  return `begin;
${options.standalone ? standaloneSchema() : ""}
${options.standalone ? standaloneFixture : liveFixture}
insert into public.vault_assets values ('${id.asset}', '${id.owner}', 'document_location',
  'VaultCiphertext_00000000000000000001', 'VaultNonce_0000000000000001',
  now() - interval '2 hours', now() - interval '1 hour', null);
set local role service_role;
do $test$
declare v_assets jsonb; v_grants jsonb; v_result jsonb;
begin
  select jsonb_build_array(jsonb_build_object('asset_id', id, 'asset_type', asset_type,
    'ciphertext', ciphertext, 'nonce', nonce, 'ciphertext_digest',
    encode(extensions.digest(concat_ws('|', id::text, asset_type, ciphertext, nonce),
      'sha256'), 'hex'))) into v_assets from public.vault_assets where id = '${id.asset}';
  select jsonb_agg(jsonb_build_object('grant_id', id, 'grant_version', grant_version,
    'recipient_key_id', recipient_key_id, 'recipient_key_version', recipient_key_version,
    'sealed_grant_digest', encode(extensions.digest(concat_ws('|', id::text,
      grant_version::text, recipient_key_id::text, recipient_key_version::text, protocol,
      profile, key_agreement, kdf, aead, owner_ephemeral_public_key, nonce, ciphertext),
      'sha256'), 'hex')) order by id) into v_grants
    from public.claimant_recipient_grants where case_id = '${id.case}';
  begin perform public.claimant_prepare_encrypted_release_package('${id.claimant}',
    '${id.case}', '${id.authorization}', '${id.cycle}', '${id.round}', 6,
    '${id.package}', 'synthetic_release_package_slice_4b', v_assets, v_grants, '${id.hostile}');
    raise exception 'wrong owner was accepted';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_prepare_encrypted_release_package('${id.owner}',
    '${id.case}', '${id.authorization}', '${id.cycle}', '${id.round}', 6,
    '${id.package}', 'synthetic_release_package_slice_4b',
    jsonb_set(v_assets, '{0,ciphertext}', '"TamperedCiphertext_000000000000000"'),
    v_grants, '${id.hostile}');
    raise exception 'tampered ciphertext was accepted';
  exception when serialization_failure then null; end;
  begin
    update public.claimant_recipient_grants set status = 'revoked' where id = '${id.grant2}';
    begin perform public.claimant_prepare_encrypted_release_package('${id.owner}',
      '${id.case}', '${id.authorization}', '${id.cycle}', '${id.round}', 6,
      '${id.package}', 'synthetic_release_package_slice_4b', v_assets, v_grants, '${id.hostile}');
      raise exception 'revoked grant was accepted';
    exception when serialization_failure then null; end;
    raise exception 'ROLLBACK_GRANT' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ROLLBACK_GRANT' then raise; end if;
  end;
  begin
    insert into public.claimant_review_interventions values ('${id.intervention}', '${id.case}');
    begin perform public.claimant_prepare_encrypted_release_package('${id.owner}',
      '${id.case}', '${id.authorization}', '${id.cycle}', '${id.round}', 6,
      '${id.package}', 'synthetic_release_package_slice_4b', v_assets, v_grants, '${id.hostile}');
      raise exception 'intervention was accepted';
    exception when insufficient_privilege then null; end;
    raise exception 'ROLLBACK_INTERVENTION' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ROLLBACK_INTERVENTION' then raise; end if;
  end;
  begin perform public.claimant_prepare_encrypted_release_package('${id.owner}',
    '${id.case}', '${id.authorization}', '${id.cycle}', '${id.round}', 6,
    '${id.package}', 'synthetic_release_package_slice_4b',
    v_assets || (v_assets -> 0), v_grants, '${id.hostile}');
    raise exception 'duplicate asset was accepted';
  exception when invalid_parameter_value then null; end;
  v_result := public.claimant_prepare_encrypted_release_package('${id.owner}',
    '${id.case}', '${id.authorization}', '${id.cycle}', '${id.round}', 6,
    '${id.package}', 'synthetic_release_package_slice_4b', v_assets, v_grants, '${id.first}');
  if v_result ->> 'package_status' <> 'prepared_unsigned'
    or (v_result ->> 'manifest_signed')::boolean
    or (v_result ->> 'retrieval_authorized')::boolean
    or v_result ->> 'case_state' <> 'approved'
    or (v_result ->> 'case_version')::integer <> 6
    or (v_result ->> 'asset_count')::integer <> 1
    or (v_result ->> 'grant_count')::integer <> 2 then
    raise exception 'encrypted package result was unsafe'; end if;
  if not (public.claimant_prepare_encrypted_release_package('${id.owner}',
    '${id.case}', '${id.authorization}', '${id.cycle}', '${id.round}', 6,
    '${id.package}', 'synthetic_release_package_slice_4b', v_assets, v_grants,
    '${id.first}') ->> 'replayed')::boolean then
    raise exception 'encrypted package replay was unstable'; end if;
  begin perform public.claimant_prepare_encrypted_release_package('${id.owner}',
    '${id.case}', '${id.authorization}', '${id.cycle}', '${id.round}', 6,
    '${id.package}', 'synthetic_release_package_changed', v_assets, v_grants, '${id.first}');
    raise exception 'changed replay was accepted';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.claimant_release_packages) <> 1
    or (select count(*) from public.claimant_release_package_assets) <> 1
    or (select count(*) from public.claimant_release_package_grants) <> 2
    or (select count(*) from public.claimant_release_package_events) <> 1
    or (select ciphertext from public.claimant_release_package_assets) <>
      (select ciphertext from public.vault_assets where id = '${id.asset}')
    or (select state from public.claimant_cases where id = '${id.case}') <> 'approved'
    or (select version from public.claimant_cases where id = '${id.case}') <> 6 then
    raise exception 'encrypted package atomic records failed'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_release_packages;
    raise exception 'authenticated role read encrypted package';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_prepare_encrypted_release_package('${id.owner}',
    '${id.case}', '${id.authorization}', '${id.cycle}', '${id.round}', 6,
    '${id.package}', 'synthetic_release_package_slice_4b', '[]', '[]', '${id.changed}');
    raise exception 'authenticated role called package preparation';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role; rollback;
select 'CLAIMANT_ENCRYPTED_PACKAGE_DB_TEST_PASSED';`;
}

function runClaimantEncryptedPackageDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildClaimantEncryptedPackageDbTestSql(options) });
  if (!output.includes("CLAIMANT_ENCRYPTED_PACKAGE_DB_TEST_PASSED"))
    throw new Error("Encrypted-package DB marker was missing.");
}

if (require.main === module) {
  runClaimantEncryptedPackageDbTest();
  console.log("Claimant encrypted-package DB test passed.");
}

module.exports = { buildClaimantEncryptedPackageDbTestSql,
  runClaimantEncryptedPackageDbTest, standaloneSchema };
