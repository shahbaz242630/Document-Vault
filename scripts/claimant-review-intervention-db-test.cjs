const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const DEFAULT_CONTAINER = "supabase_db_supabase";
const migration = readFileSync(join(__dirname,
  "../supabase/migrations/20260818170000_claimant_review_escalation_appeal_foundation.sql"),
"utf8");

function standaloneSchema() { return `
create role anon nologin; create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create schema extensions; create extension pgcrypto with schema extensions;
grant usage on schema extensions to service_role;
grant execute on all functions in schema extensions to service_role;
create table public.claimant_cases(id uuid primary key, claimant_user_id uuid not null,
  owner_user_id uuid not null, state text not null, version integer not null);
create table public.claimant_owner_protection_cycles(id uuid primary key, case_id uuid not null,
  unique(id, case_id));
create table public.claimant_reviewer_identities(id uuid primary key, user_id uuid not null);
create table public.claimant_reviewer_assignments(id uuid primary key, case_id uuid not null,
  cycle_id uuid not null, reviewer_identity_id uuid not null);
create table public.claimant_review_rounds(id uuid primary key, case_id uuid not null,
  cycle_id uuid not null, case_version integer not null, status text not null,
  round_version integer not null, two_person_approval_satisfied boolean not null,
  release_authorized boolean not null check (not release_authorized),
  completed_at timestamptz, updated_at timestamptz not null, unique(id, case_id));
grant all on all tables in schema public to service_role;
${migration}`; }

function buildClaimantReviewInterventionDbTestSql(options = {}) {
  const names = ["case1", "case2", "cycle1", "cycle2", "round1", "round2", "owner1",
    "owner2", "claimant1", "claimant2", "reviewerUser", "reviewer", "escalatorUser",
    "appealUser", "escalator", "appeal", "ownerAuthority", "intervention1",
    "intervention2", "replayChanged", "duplicate", "invitation1", "invitation2",
    "key1", "key2"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  const standaloneFixture = `
insert into auth.users(id) values ('${id.owner1}'), ('${id.owner2}'), ('${id.claimant1}'),
  ('${id.claimant2}'), ('${id.reviewerUser}'), ('${id.escalatorUser}'), ('${id.appealUser}');
insert into public.claimant_cases values
  ('${id.case1}', '${id.claimant1}', '${id.owner1}', 'cooldown', 5),
  ('${id.case2}', '${id.claimant2}', '${id.owner2}', 'cooldown', 5);
insert into public.claimant_owner_protection_cycles values
  ('${id.cycle1}', '${id.case1}'), ('${id.cycle2}', '${id.case2}');
insert into public.claimant_reviewer_identities values ('${id.reviewer}', '${id.reviewerUser}');
insert into public.claimant_reviewer_assignments values
  (gen_random_uuid(), '${id.case1}', '${id.cycle1}', '${id.reviewer}');
insert into public.claimant_review_rounds values
  ('${id.round1}', '${id.case1}', '${id.cycle1}', 5, 'two_person_approved', 2, true,
    false, now(), now()),
  ('${id.round2}', '${id.case2}', '${id.cycle2}', 5, 'rejected', 2, false,
    false, now(), now());`;
  const liveFixture = `
insert into auth.users(id) values ('${id.owner1}'), ('${id.owner2}'), ('${id.claimant1}'),
  ('${id.claimant2}'), ('${id.reviewerUser}'), ('${id.escalatorUser}'), ('${id.appealUser}');
insert into public.claimant_identities(user_id, status) values
  ('${id.claimant1}', 'active'), ('${id.claimant2}', 'active');
insert into public.claimant_invitations(id, owner_user_id, recipient_address_digest, status,
  accepted_by_user_id, expires_at, accepted_at) values
  ('${id.invitation1}', '${id.owner1}', repeat('a', 64), 'accepted', '${id.claimant1}',
    now() + interval '1 day', now()),
  ('${id.invitation2}', '${id.owner2}', repeat('b', 64), 'accepted', '${id.claimant2}',
    now() + interval '1 day', now());
insert into public.claimant_device_keys(id, claimant_user_id, device_binding_digest, public_key_jwk)
values ('${id.key1}', '${id.claimant1}', repeat('c', 64),
    jsonb_build_object('kty','EC','crv','P-256','x',repeat('A',43),'y',repeat('B',43))),
  ('${id.key2}', '${id.claimant2}', repeat('d', 64),
    jsonb_build_object('kty','EC','crv','P-256','x',repeat('C',43),'y',repeat('D',43)));
insert into public.claimant_cases(id, claimant_user_id, owner_user_id, invitation_id,
  current_key_id, state, policy_pack_id, policy_pack_version, version) values
  ('${id.case1}', '${id.claimant1}', '${id.owner1}', '${id.invitation1}', '${id.key1}',
    'cooldown', 'synthetic_policy_death_alpha', 1, 5),
  ('${id.case2}', '${id.claimant2}', '${id.owner2}', '${id.invitation2}', '${id.key2}',
    'cooldown', 'synthetic_policy_death_alpha', 1, 5);
insert into public.claimant_submission_receipts(case_id, claimant_user_id, synthetic_only,
  submission_ref, acknowledgement_ref, submission_digest, case_version, intake_version,
  preparation_version, evidence_object_count, unavailable_item_count, status, review_started,
  release_authorized, claimed_created_at) values
  ('${id.case1}', '${id.claimant1}', true, 'synthetic_submission_intervention_one',
    'synthetic_acknowledgement_${"a".repeat(32)}', repeat('e', 64), 3, 9, 9, 1, 0,
    'received_for_review', false, false, now() - interval '2 days'),
  ('${id.case2}', '${id.claimant2}', true, 'synthetic_submission_intervention_two',
    'synthetic_acknowledgement_${"b".repeat(32)}', repeat('f', 64), 3, 9, 9, 1, 0,
    'received_for_review', false, false, now() - interval '2 days');
insert into public.claimant_owner_protection_cycles(id, case_id, owner_user_id,
  claimant_user_id, policy_pack_id, policy_pack_version, submission_case_version,
  cycle_number, notice_ref, status, cooldown_seconds, delivery_evidence_digest,
  delivery_verified_at, cooldown_started_at, cooldown_expires_at) values
  ('${id.cycle1}', '${id.case1}', '${id.owner1}', '${id.claimant1}',
    'synthetic_policy_death_alpha', 1, 3, 1, 'synthetic_owner_notice_intervention_one',
    'delivery_verified', 86400, repeat('1', 64), now() - interval '2 days',
    now() - interval '2 days', now() - interval '1 day'),
  ('${id.cycle2}', '${id.case2}', '${id.owner2}', '${id.claimant2}',
    'synthetic_policy_death_alpha', 1, 3, 1, 'synthetic_owner_notice_intervention_two',
    'delivery_verified', 86400, repeat('2', 64), now() - interval '2 days',
    now() - interval '2 days', now() - interval '1 day');
insert into public.claimant_reviewer_identities(id, user_id, pseudonymous_ref, reviewer_class)
values ('${id.reviewer}', '${id.reviewerUser}', 'synthetic_reviewer_intervention',
  'accountable_human_test');
insert into public.claimant_reviewer_assignments(id, case_id, cycle_id,
  reviewer_identity_id, assignment_slot, assigned_case_version, cycle_number, status)
values (gen_random_uuid(), '${id.case1}', '${id.cycle1}', '${id.reviewer}', 1, 5, 1, 'assigned');
insert into public.claimant_review_rounds(id, case_id, cycle_id, case_version,
  submission_case_version, intake_version, preparation_version, policy_pack_id,
  policy_pack_version, checklist_digest, evidence_manifest_digest, status, round_version,
  two_person_approval_satisfied, release_authorized, completed_at, updated_at) values
  ('${id.round1}', '${id.case1}', '${id.cycle1}', 5, 3, 9, 9,
    'synthetic_policy_death_alpha', 1, repeat('3', 64), repeat('4', 64),
    'two_person_approved', 2, true, false, now(), now()),
  ('${id.round2}', '${id.case2}', '${id.cycle2}', 5, 3, 9, 9,
    'synthetic_policy_death_alpha', 1, repeat('5', 64), repeat('6', 64),
    'rejected', 2, false, false, now(), now());`;
  return `begin;
${options.standalone ? standaloneSchema() : ""}
${options.standalone ? standaloneFixture : liveFixture}
insert into public.claimant_review_resolution_authorities
  (id, user_id, pseudonymous_ref, authority_class) values
  ('${id.escalator}', '${id.escalatorUser}', 'synthetic_resolution_authority_escalator',
    'escalation_test_operator'),
  ('${id.appeal}', '${id.appealUser}', 'synthetic_resolution_authority_appeal',
    'appeal_test_operator'),
  ('${id.ownerAuthority}', '${id.owner1}', 'synthetic_resolution_authority_owner_hostile',
    'escalation_test_operator');
set local role service_role;
do $test$
declare v_first jsonb; v_second jsonb;
begin
  v_first := public.claimant_open_review_intervention('${id.case1}', '${id.cycle1}',
    '${id.round1}', '${id.escalator}', 5, 2, 'escalation', 'independence_concern',
    '${id.intervention1}');
  if v_first ->> 'review_status' <> 'held' or (v_first ->> 'release_authorized')::boolean
    or (v_first ->> 'two_person_approval_satisfied')::boolean
    or (v_first ->> 'round_version')::integer <> 3 then
    raise exception 'escalation failed to invalidate aggregate approval'; end if;
  if not (public.claimant_open_review_intervention('${id.case1}', '${id.cycle1}',
    '${id.round1}', '${id.escalator}', 5, 2, 'escalation', 'independence_concern',
    '${id.intervention1}') ->> 'replayed')::boolean then
    raise exception 'intervention replay was unstable'; end if;
  begin perform public.claimant_open_review_intervention('${id.case1}', '${id.cycle1}',
    '${id.round1}', '${id.escalator}', 5, 2, 'escalation', 'procedural_error',
    '${id.intervention1}'); raise exception 'changed replay was accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.claimant_open_review_intervention('${id.case1}', '${id.cycle1}',
    '${id.round1}', '${id.escalator}', 5, 3, 'escalation', 'procedural_error',
    '${id.duplicate}'); raise exception 'duplicate intervention was accepted';
  exception when serialization_failure then null; end;
  begin perform public.claimant_open_review_intervention('${id.case2}', '${id.cycle2}',
    '${id.round2}', '${id.escalator}', 5, 2, 'appeal', 'procedural_error',
    '${id.replayChanged}'); raise exception 'wrong authority class opened appeal';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_open_review_intervention('${id.case1}', '${id.cycle1}',
    '${id.round1}', '${id.ownerAuthority}', 5, 3, 'escalation', 'procedural_error',
    '${id.replayChanged}'); raise exception 'case owner opened intervention';
  exception when insufficient_privilege then null; end;
  v_second := public.claimant_open_review_intervention('${id.case2}', '${id.cycle2}',
    '${id.round2}', '${id.appeal}', 5, 2, 'appeal', 'new_material_information',
    '${id.intervention2}');
  if v_second ->> 'review_status' <> 'held'
    or v_second ->> 'intervention_type' <> 'appeal'
    or (v_second ->> 'release_authorized')::boolean then
    raise exception 'appeal failed closed'; end if;
  if (select count(*) from public.claimant_review_interventions) <> 2
    or (select count(*) from public.claimant_review_intervention_events) <> 2
    or exists (select 1 from public.claimant_cases where state <> 'cooldown') then
    raise exception 'intervention atomic records or case isolation failed'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_review_interventions;
    raise exception 'authenticated role read interventions';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_open_review_intervention('${id.case1}', '${id.cycle1}',
    '${id.round1}', '${id.escalator}', 5, 3, 'escalation', 'procedural_error',
    '${id.replayChanged}'); raise exception 'authenticated role called intervention';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role; rollback;
select 'CLAIMANT_REVIEW_INTERVENTION_DB_TEST_PASSED';`;
}
function runClaimantReviewInterventionDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildClaimantReviewInterventionDbTestSql(options) });
  if (!output.includes("CLAIMANT_REVIEW_INTERVENTION_DB_TEST_PASSED"))
    throw new Error("Review-intervention DB marker was missing.");
}
if (require.main === module) { runClaimantReviewInterventionDbTest();
  console.log("Claimant review-intervention DB test passed."); }
module.exports = { buildClaimantReviewInterventionDbTestSql,
  runClaimantReviewInterventionDbTest };
