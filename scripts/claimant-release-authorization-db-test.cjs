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
  return `begin;
${options.standalone ? standaloneSchema() : ""}
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
  ('${id.grant2}', '${id.case}', '${id.owner}', '${id.claimant}', '${id.key2}', 1, 'active');
insert into public.claimant_release_authority_identities
  (id, user_id, pseudonymous_ref, authority_class) values
  ('${id.authority}', '${id.authorityUser}', 'synthetic_release_authority_primary',
    'release_test_authorizer'),
  ('${id.ownerAuthority}', '${id.owner}', 'synthetic_release_authority_owner_hostile',
    'release_test_authorizer');
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
    insert into public.claimant_review_interventions values ('${id.intervention}', '${id.case}');
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
