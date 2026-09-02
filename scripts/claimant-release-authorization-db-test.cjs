const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const DEFAULT_CONTAINER = "supabase_db_supabase";
const migration = readFileSync(join(__dirname,
  "../supabase/migrations/20260818180000_claimant_release_authorization_foundation.sql"),
"utf8");

function standaloneSchema() { return `
create role anon nologin; create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create schema extensions; create extension pgcrypto with schema extensions;
grant usage on schema extensions to service_role;
grant execute on all functions in schema extensions to service_role;
create table public.claimant_cases(id uuid primary key, claimant_user_id uuid not null,
  owner_user_id uuid not null, current_key_id uuid not null, state text not null,
  policy_pack_id text not null, policy_pack_version integer not null, version integer not null,
  binding_version integer not null, finalization_version integer not null,
  owner_finalized_at timestamptz, updated_at timestamptz not null);
create table public.claimant_owner_protection_cycles(id uuid primary key, case_id uuid not null,
  owner_user_id uuid not null, claimant_user_id uuid not null, policy_pack_id text not null,
  policy_pack_version integer not null, status text not null, cooldown_expires_at timestamptz,
  unique(id, case_id));
create table public.claimant_submission_receipts(case_id uuid primary key,
  case_version integer not null, status text not null, review_started boolean not null,
  release_authorized boolean not null, unique(case_id, case_version));
create table public.claimant_reviewer_identities(id uuid primary key, user_id uuid not null,
  status text not null, synthetic_only boolean not null, live_review_authority boolean not null);
create table public.claimant_reviewer_assignments(id uuid primary key, case_id uuid not null,
  cycle_id uuid not null, reviewer_identity_id uuid not null, status text not null,
  assignment_version integer not null);
create table public.claimant_review_rounds(id uuid primary key, case_id uuid not null,
  cycle_id uuid not null, case_version integer not null, submission_case_version integer not null,
  policy_pack_id text not null, policy_pack_version integer not null, status text not null,
  round_version integer not null, two_person_approval_satisfied boolean not null,
  release_authorized boolean not null, unique(id, case_id));
create table public.claimant_review_decisions(id uuid primary key, review_round_id uuid not null,
  case_id uuid not null, assignment_id uuid not null, reviewer_identity_id uuid not null,
  assignment_version integer not null, decision text not null);
create table public.claimant_review_resolution_authorities(id uuid primary key, user_id uuid not null);
create table public.claimant_review_interventions(id uuid primary key, case_id uuid not null);
create table public.claimant_device_keys(id uuid primary key, claimant_user_id uuid not null,
  status text not null, key_version integer not null);
create table public.claimant_case_device_keys(case_id uuid not null, key_id uuid not null,
  claimant_user_id uuid not null, status text not null, primary key(case_id, key_id));
create table public.claimant_recipient_grants(id uuid primary key, case_id uuid not null,
  owner_user_id uuid not null, claimant_user_id uuid not null, recipient_key_id uuid not null,
  recipient_key_version integer not null, status text not null);
grant all on all tables in schema public to service_role;
${migration}`; }

function buildClaimantReleaseAuthorizationDbTestSql(options = {}) {
  const names = ["case", "cycle", "round", "owner", "claimant", "reviewerUser1",
    "reviewerUser2", "reviewer1", "reviewer2", "assignment1", "assignment2",
    "decision1", "decision2", "key1", "key2", "grant1", "grant2", "authorityUser",
    "authority", "ownerAuthority", "intervention", "first", "changed", "hostile"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  const standaloneFixture = `
insert into auth.users(id) values ('${id.owner}'), ('${id.claimant}'),
  ('${id.reviewerUser1}'), ('${id.reviewerUser2}'), ('${id.authorityUser}');
insert into public.claimant_cases values ('${id.case}', '${id.claimant}', '${id.owner}',
  '${id.key1}', 'cooldown', 'synthetic_policy_death_alpha', 1, 5, 2, 1, now(), now());
insert into public.claimant_owner_protection_cycles values ('${id.cycle}', '${id.case}',
  '${id.owner}', '${id.claimant}', 'synthetic_policy_death_alpha', 1,
  'delivery_verified', now() - interval '1 day');
insert into public.claimant_submission_receipts values
  ('${id.case}', 3, 'received_for_review', false, false);
insert into public.claimant_reviewer_identities values
  ('${id.reviewer1}', '${id.reviewerUser1}', 'active', true, false),
  ('${id.reviewer2}', '${id.reviewerUser2}', 'active', true, false);
insert into public.claimant_reviewer_assignments values
  ('${id.assignment1}', '${id.case}', '${id.cycle}', '${id.reviewer1}', 'assigned', 1),
  ('${id.assignment2}', '${id.case}', '${id.cycle}', '${id.reviewer2}', 'assigned', 1);
insert into public.claimant_review_rounds values ('${id.round}', '${id.case}', '${id.cycle}',
  5, 3, 'synthetic_policy_death_alpha', 1, 'two_person_approved', 2, true, false);
insert into public.claimant_review_decisions values
  ('${id.decision1}', '${id.round}', '${id.case}', '${id.assignment1}', '${id.reviewer1}', 1, 'allow'),
  ('${id.decision2}', '${id.round}', '${id.case}', '${id.assignment2}', '${id.reviewer2}', 1, 'allow');
insert into public.claimant_device_keys values
  ('${id.key1}', '${id.claimant}', 'active', 1), ('${id.key2}', '${id.claimant}', 'active', 1);
insert into public.claimant_case_device_keys values
  ('${id.case}', '${id.key1}', '${id.claimant}', 'active'),
  ('${id.case}', '${id.key2}', '${id.claimant}', 'active');
insert into public.claimant_recipient_grants values
  ('${id.grant1}', '${id.case}', '${id.owner}', '${id.claimant}', '${id.key1}', 1, 'active'),
  ('${id.grant2}', '${id.case}', '${id.owner}', '${id.claimant}', '${id.key2}', 1, 'active');`;
  const liveFixture = `
insert into auth.users(id) values ('${id.owner}'), ('${id.claimant}'),
  ('${id.reviewerUser1}'), ('${id.reviewerUser2}'), ('${id.authorityUser}');
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
  'cooldown', 'synthetic_policy_death_alpha', 1, 5, 2, 1, now()
from public.claimant_invitations invitation where invitation.owner_user_id = '${id.owner}';
insert into public.claimant_submission_receipts(case_id, claimant_user_id, synthetic_only,
  submission_ref, acknowledgement_ref, submission_digest, case_version, intake_version,
  preparation_version, evidence_object_count, unavailable_item_count, status, review_started,
  release_authorized, claimed_created_at)
values ('${id.case}', '${id.claimant}', true, 'synthetic_submission_release_authorization',
  'synthetic_acknowledgement_${"a".repeat(32)}', repeat('d', 64), 3, 9, 9, 1, 0,
  'received_for_review', false, false, now() - interval '2 days');
insert into public.claimant_owner_protection_cycles(id, case_id, owner_user_id,
  claimant_user_id, policy_pack_id, policy_pack_version, submission_case_version,
  cycle_number, notice_ref, status, cooldown_seconds, delivery_evidence_digest,
  delivery_verified_at, cooldown_started_at, cooldown_expires_at)
values ('${id.cycle}', '${id.case}', '${id.owner}', '${id.claimant}',
  'synthetic_policy_death_alpha', 1, 3, 1, 'synthetic_owner_notice_release_authorization',
  'delivery_verified', 86400, repeat('e', 64), now() - interval '2 days',
  now() - interval '2 days', now() - interval '1 day');
insert into public.claimant_reviewer_identities(id, user_id, pseudonymous_ref, reviewer_class)
values ('${id.reviewer1}', '${id.reviewerUser1}', 'synthetic_reviewer_release_one',
    'accountable_human_test'),
  ('${id.reviewer2}', '${id.reviewerUser2}', 'synthetic_reviewer_release_two',
    'accountable_human_test');
insert into public.claimant_reviewer_assignments(id, case_id, cycle_id,
  reviewer_identity_id, assignment_slot, assigned_case_version, cycle_number, status)
values ('${id.assignment1}', '${id.case}', '${id.cycle}', '${id.reviewer1}', 1, 5, 1, 'assigned'),
  ('${id.assignment2}', '${id.case}', '${id.cycle}', '${id.reviewer2}', 2, 5, 1, 'assigned');
insert into public.claimant_review_rounds(id, case_id, cycle_id, case_version,
  submission_case_version, intake_version, preparation_version, policy_pack_id,
  policy_pack_version, checklist_digest, evidence_manifest_digest, status, round_version,
  two_person_approval_satisfied, release_authorized, completed_at)
values ('${id.round}', '${id.case}', '${id.cycle}', 5, 3, 9, 9,
  'synthetic_policy_death_alpha', 1, repeat('f', 64), repeat('1', 64),
  'two_person_approved', 2, true, false, now());
insert into public.claimant_review_decisions(review_round_id, case_id, assignment_id,
  reviewer_identity_id, assignment_slot, assignment_version, decision, reason_class,
  case_version, intake_version, preparation_version, policy_pack_id, policy_pack_version,
  checklist_digest, evidence_manifest_digest)
values ('${id.round}', '${id.case}', '${id.assignment1}', '${id.reviewer1}', 1, 1,
    'allow', 'requirements_satisfied', 5, 9, 9, 'synthetic_policy_death_alpha', 1,
    repeat('f', 64), repeat('1', 64)),
  ('${id.round}', '${id.case}', '${id.assignment2}', '${id.reviewer2}', 2, 1,
    'allow', 'requirements_satisfied', 5, 9, 9, 'synthetic_policy_death_alpha', 1,
    repeat('f', 64), repeat('1', 64));
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
  const interventionInsert = options.standalone
    ? `insert into public.claimant_review_interventions values ('${id.intervention}', '${id.case}');`
    : `insert into public.claimant_review_interventions(id, case_id, cycle_id, review_round_id,
        authority_identity_id, intervention_type, reason_class, source_review_status,
        source_round_version) values ('${id.intervention}', '${id.case}', '${id.cycle}',
        '${id.round}', '${id.ownerAuthority}', 'escalation', 'policy_review_required',
        'two_person_approved', 2);`;
  return `begin;
${options.standalone ? standaloneSchema() : ""}
${options.standalone ? standaloneFixture : liveFixture}
insert into public.claimant_release_authority_identities
  (id, user_id, pseudonymous_ref, authority_class) values
  ('${id.authority}', '${id.authorityUser}', 'synthetic_release_authority_primary',
    'release_test_authorizer'),
  ('${id.ownerAuthority}', '${id.owner}', 'synthetic_release_authority_owner_hostile',
    'release_test_authorizer');
insert into public.claimant_review_resolution_authorities
  ${options.standalone ? "values" : "(id, user_id, pseudonymous_ref, authority_class) values"}
  ('${id.ownerAuthority}', '${id.owner}'${options.standalone ? "" : ", 'synthetic_resolution_authority_release_hostile', 'escalation_test_operator'"});
set local role service_role;
do $test$
declare v_result jsonb;
begin
  begin
    update public.claimant_recipient_grants set status = 'revoked' where id = '${id.grant2}';
    begin perform public.claimant_authorize_release('${id.case}', '${id.cycle}', '${id.round}',
      '${id.authority}', 5, 2, 2, 1, '${id.hostile}');
      raise exception 'missing grant was accepted';
    exception when serialization_failure then null; end;
    raise exception 'ROLLBACK_MISSING_GRANT' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ROLLBACK_MISSING_GRANT' then raise; end if;
  end;
  begin
    ${interventionInsert}
    begin perform public.claimant_authorize_release('${id.case}', '${id.cycle}', '${id.round}',
      '${id.authority}', 5, 2, 2, 1, '${id.hostile}');
      raise exception 'open intervention was accepted';
    exception when serialization_failure then null; end;
    raise exception 'ROLLBACK_INTERVENTION' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ROLLBACK_INTERVENTION' then raise; end if;
  end;
  begin
    update public.claimant_reviewer_identities set status = 'suspended'
      where id = '${id.reviewer1}';
    begin perform public.claimant_authorize_release('${id.case}', '${id.cycle}', '${id.round}',
      '${id.authority}', 5, 2, 2, 1, '${id.hostile}');
      raise exception 'stale reviewer authority was accepted';
    exception when serialization_failure then null; end;
    raise exception 'ROLLBACK_REVIEWER' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ROLLBACK_REVIEWER' then raise; end if;
  end;
  begin perform public.claimant_authorize_release('${id.case}', '${id.cycle}', '${id.round}',
    '${id.ownerAuthority}', 5, 2, 2, 1, '${id.hostile}');
    raise exception 'owner final-authorized release';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_authorize_release('${id.case}', '${id.cycle}', '${id.round}',
    '${id.authority}', 5, 3, 2, 1, '${id.hostile}');
    raise exception 'stale round version was accepted';
  exception when insufficient_privilege then null; end;
  v_result := public.claimant_authorize_release('${id.case}', '${id.cycle}', '${id.round}',
    '${id.authority}', 5, 2, 2, 1, '${id.first}');
  if v_result ->> 'case_state' <> 'approved'
    or not (v_result ->> 'release_authorized')::boolean
    or (v_result ->> 'package_creation_authorized')::boolean
    or (v_result ->> 'retrieval_authorized')::boolean
    or (v_result ->> 'case_version')::integer <> 6 then
    raise exception 'release authorization result was unsafe'; end if;
  if not (public.claimant_authorize_release('${id.case}', '${id.cycle}', '${id.round}',
    '${id.authority}', 5, 2, 2, 1, '${id.first}') ->> 'replayed')::boolean then
    raise exception 'release replay was unstable'; end if;
  begin perform public.claimant_authorize_release('${id.case}', '${id.cycle}', '${id.round}',
    '${id.authority}', 5, 2, 3, 1, '${id.first}');
    raise exception 'changed replay was accepted';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.claimant_release_authorizations) <> 1
    or (select count(*) from public.claimant_release_authorization_events) <> 1
    or (select state from public.claimant_cases where id = '${id.case}') <> 'approved'
    or (select package_creation_authorized from public.claimant_release_authorizations)
    or (select retrieval_authorized from public.claimant_release_authorizations) then
    raise exception 'release authorization atomic records failed'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_release_authorizations;
    raise exception 'authenticated role read release authorization';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_authorize_release('${id.case}', '${id.cycle}', '${id.round}',
    '${id.authority}', 5, 2, 2, 1, '${id.changed}');
    raise exception 'authenticated role called release authorization';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role; rollback;
select 'CLAIMANT_RELEASE_AUTHORIZATION_DB_TEST_PASSED';`;
}
function runClaimantReleaseAuthorizationDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildClaimantReleaseAuthorizationDbTestSql(options) });
  if (!output.includes("CLAIMANT_RELEASE_AUTHORIZATION_DB_TEST_PASSED"))
    throw new Error("Release-authorization DB marker was missing.");
}
if (require.main === module) { runClaimantReleaseAuthorizationDbTest();
  console.log("Claimant release-authorization DB test passed."); }
module.exports = { buildClaimantReleaseAuthorizationDbTestSql,
  runClaimantReleaseAuthorizationDbTest };
