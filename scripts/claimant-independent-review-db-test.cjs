const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const DEFAULT_CONTAINER = "supabase_db_supabase";
const migration = readFileSync(join(__dirname,
  "../supabase/migrations/20260818160000_claimant_independent_review_foundation.sql"), "utf8");

function standaloneSchema() { return `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create schema extensions; create extension pgcrypto with schema extensions;
grant usage on schema extensions to service_role;
grant execute on all functions in schema extensions to service_role;
create table public.claimant_cases(id uuid primary key, state text not null, version integer not null,
  policy_pack_id text not null, policy_pack_version integer not null);
create table public.claimant_owner_protection_cycles(id uuid primary key, case_id uuid not null,
  status text not null, cooldown_expires_at timestamptz, unique(id, case_id));
create table public.claimant_submission_receipts(case_id uuid primary key,
  case_version integer not null, intake_version integer not null, preparation_version integer not null,
  review_started boolean not null, release_authorized boolean not null,
  evidence_object_count integer not null, unique(case_id, case_version));
create table public.claimant_intake_snapshots(case_id uuid primary key, version integer not null,
  policy_pack_id text not null, policy_pack_version integer not null, status text not null);
create table public.claimant_checklist_items(case_id uuid not null, item_key text not null,
  availability text not null, primary key(case_id, item_key));
create table public.claimant_evidence_upload_capabilities(id uuid primary key, case_id uuid not null,
  preparation_version integer not null);
create table public.claimant_evidence_objects(id uuid primary key, capability_id uuid not null,
  case_id uuid not null, version integer not null, content_digest text not null, status text not null);
create table public.claimant_reviewer_identities(id uuid primary key, status text not null,
  synthetic_only boolean not null, live_review_authority boolean not null);
create table public.claimant_reviewer_assignments(id uuid primary key, case_id uuid not null,
  cycle_id uuid not null, reviewer_identity_id uuid not null, assignment_slot smallint not null,
  status text not null, assignment_version integer not null, unique(id, case_id));
grant all on all tables in schema public to service_role;
${migration}`; }

function buildClaimantIndependentReviewDbTestSql(options = {}) {
  const names = ["case", "cycle", "reviewer1", "reviewer2", "assignment1", "assignment2",
    "capability", "object", "first", "second", "hostile", "otherCase", "owner", "claimant",
    "invitation", "key", "reviewer1User", "reviewer2User"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  const standaloneFixture = `
insert into public.claimant_cases values ('${id.case}', 'cooldown', 5,
  'synthetic_policy_death_alpha', 1);
insert into public.claimant_owner_protection_cycles values ('${id.cycle}', '${id.case}',
  'delivery_verified', now() - interval '1 day');
insert into public.claimant_submission_receipts values ('${id.case}', 3, 9, 9, false, false, 1);
insert into public.claimant_intake_snapshots values ('${id.case}', 9,
  'synthetic_policy_death_alpha', 1, 'ready_for_review');
insert into public.claimant_checklist_items values
  ('${id.case}', 'claimant_photo_identity', 'available'),
  ('${id.case}', 'official_death_record', 'available');
insert into public.claimant_evidence_upload_capabilities values ('${id.capability}', '${id.case}', 9);
insert into public.claimant_evidence_objects values ('${id.object}', '${id.capability}', '${id.case}',
  2, repeat('e', 64), 'clean');
insert into public.claimant_reviewer_identities values
  ('${id.reviewer1}', 'active', true, false), ('${id.reviewer2}', 'active', true, false);
insert into public.claimant_reviewer_assignments values
  ('${id.assignment1}', '${id.case}', '${id.cycle}', '${id.reviewer1}', 1, 'assigned', 1),
  ('${id.assignment2}', '${id.case}', '${id.cycle}', '${id.reviewer2}', 2, 'assigned', 1);`;
  const liveFixture = `
insert into auth.users(id) values ('${id.owner}'), ('${id.claimant}'),
  ('${id.reviewer1User}'), ('${id.reviewer2User}');
insert into public.claimant_identities(user_id, status) values ('${id.claimant}', 'active');
insert into public.claimant_invitations(id, owner_user_id, recipient_address_digest, status,
  accepted_by_user_id, expires_at, accepted_at)
values ('${id.invitation}', '${id.owner}', repeat('a', 64), 'accepted', '${id.claimant}',
  now() + interval '1 day', now());
insert into public.claimant_device_keys(id, claimant_user_id, device_binding_digest, public_key_jwk)
values ('${id.key}', '${id.claimant}', repeat('b', 64),
  jsonb_build_object('kty','EC','crv','P-256','x',repeat('A',43),'y',repeat('B',43)));
insert into public.claimant_cases(id, claimant_user_id, owner_user_id, invitation_id,
  current_key_id, state, policy_pack_id, policy_pack_version, version)
values ('${id.case}', '${id.claimant}', '${id.owner}', '${id.invitation}', '${id.key}',
  'cooldown', 'synthetic_policy_death_alpha', 1, 5);
insert into public.claimant_intake_snapshots(case_id, claimant_user_id, synthetic_only,
  jurisdiction_key, trigger_type, routing_conditions, policy_pack_id, policy_pack_version,
  status, version)
values ('${id.case}', '${id.claimant}', true, 'synthetic_jurisdiction_alpha', 'death',
  '{"probate_required":false,"relationship_evidence_required":false,"name_variation_present":false,
  "translation_required":false,"attestation_required":false,"dispute_known":false}'::jsonb,
  'synthetic_policy_death_alpha', 1, 'ready_for_review', 9);
insert into public.claimant_checklist_items(case_id, item_key, source, availability) values
  ('${id.case}', 'claimant_photo_identity', 'common', 'available'),
  ('${id.case}', 'official_death_record', 'common', 'available');
insert into public.claimant_evidence_preparation_items(case_id, preparation_version,
  claimant_user_id, policy_pack_id, policy_pack_version, bundle_ref, item_key, disposition,
  placeholder_ref, media_type, size_bytes, claimed_prepared_at, synthetic_only)
values ('${id.case}', 9, '${id.claimant}', 'synthetic_policy_death_alpha', 1,
  'synthetic_bundle_review', 'claimant_photo_identity', 'prepared',
  'synthetic_evidence_review', 'application/pdf', 1024, now() - interval '1 minute', true);
insert into public.claimant_evidence_upload_capabilities(id, case_id, claimant_user_id,
  preparation_version, item_key, placeholder_ref, object_path, capability_digest,
  expected_media_type, expected_size_bytes, status, expires_at, consumed_at)
values ('${id.capability}', '${id.case}', '${id.claimant}', 9, 'claimant_photo_identity',
  'synthetic_evidence_review', 'v1/${id.case}/${id.capability}', repeat('c',64),
  'application/pdf', 1024, 'consumed', now() + interval '5 minutes', now());
insert into public.claimant_evidence_objects(id, capability_id, case_id, claimant_user_id,
  item_key, object_path, content_digest, detected_media_type, size_bytes, page_count,
  expanded_size_bytes, status, scan_result, retention_policy_id, delete_after, scanned_at, version)
values ('${id.object}', '${id.capability}', '${id.case}', '${id.claimant}',
  'claimant_photo_identity', 'v1/${id.case}/${id.capability}', repeat('e',64),
  'application/pdf', 1024, 1, 1024, 'clean', 'clean', 'synthetic_retention_30d_v1',
  now() + interval '30 days', now(), 2);
insert into public.claimant_submission_receipts(case_id, claimant_user_id, synthetic_only,
  submission_ref, acknowledgement_ref, submission_digest, case_version, intake_version,
  preparation_version, evidence_object_count, unavailable_item_count, status, review_started,
  release_authorized, claimed_created_at)
values ('${id.case}', '${id.claimant}', true, 'synthetic_submission_review',
  'synthetic_acknowledgement_${"a".repeat(32)}', repeat('d',64), 3, 9, 9, 1, 0,
  'received_for_review', false, false, now() - interval '1 minute');
insert into public.claimant_owner_protection_cycles(id, case_id, owner_user_id,
  claimant_user_id, policy_pack_id, policy_pack_version, submission_case_version,
  cycle_number, notice_ref, status, cooldown_seconds, delivery_evidence_digest,
  delivery_verified_at, cooldown_started_at, cooldown_expires_at)
values ('${id.cycle}', '${id.case}', '${id.owner}', '${id.claimant}',
  'synthetic_policy_death_alpha', 1, 3, 1, 'synthetic_owner_notice_review',
  'delivery_verified', 86400, repeat('f',64), now() - interval '2 days',
  now() - interval '2 days', now() - interval '1 day');
insert into public.claimant_reviewer_identities(id, user_id, pseudonymous_ref, reviewer_class)
values ('${id.reviewer1}', '${id.reviewer1User}', 'synthetic_reviewer_review_one',
  'accountable_human_test'), ('${id.reviewer2}', '${id.reviewer2User}',
  'synthetic_reviewer_review_two', 'non_human_test_actor');
insert into public.claimant_reviewer_assignments(id, case_id, cycle_id,
  reviewer_identity_id, assignment_slot, assigned_case_version, cycle_number, status)
values ('${id.assignment1}', '${id.case}', '${id.cycle}', '${id.reviewer1}', 1, 5, 1, 'assigned'),
  ('${id.assignment2}', '${id.case}', '${id.cycle}', '${id.reviewer2}', 2, 5, 1, 'assigned');`;
  return `begin;
${options.standalone ? standaloneSchema() : ""}
${options.standalone ? standaloneFixture : liveFixture}
set local role service_role;
do $test$
declare v_checklist text; v_evidence text; v_first jsonb; v_second jsonb;
begin
  select encode(extensions.digest(string_agg(item_key || ':' || availability,
    '|' order by item_key), 'sha256'), 'hex') into v_checklist
    from public.claimant_checklist_items where case_id = '${id.case}';
  select encode(extensions.digest(string_agg(object.id::text || ':' || object.version::text || ':'
    || object.content_digest, '|' order by object.id::text), 'sha256'), 'hex') into v_evidence
    from public.claimant_evidence_objects object where object.case_id = '${id.case}';
  v_first := public.claimant_record_independent_review('${id.case}', '${id.cycle}',
    '${id.assignment1}', '${id.reviewer1}', 5, 1, 3, 9, 9,
    'synthetic_policy_death_alpha', 1, v_checklist, v_evidence,
    'allow', 'requirements_satisfied', '${id.first}');
  if v_first ->> 'review_status' <> 'pending' or (v_first ->> 'review_complete')::boolean
    or (v_first ->> 'two_person_approval_satisfied')::boolean
    or (v_first ->> 'release_authorized')::boolean then
    raise exception 'first decision exposed unsafe aggregate authority'; end if;
  if not (public.claimant_record_independent_review('${id.case}', '${id.cycle}',
    '${id.assignment1}', '${id.reviewer1}', 5, 1, 3, 9, 9,
    'synthetic_policy_death_alpha', 1, v_checklist, v_evidence,
    'allow', 'requirements_satisfied', '${id.first}') ->> 'replayed')::boolean then
    raise exception 'review replay was unstable'; end if;
  begin perform public.claimant_record_independent_review('${id.case}', '${id.cycle}',
    '${id.assignment1}', '${id.reviewer1}', 5, 1, 3, 9, 9,
    'synthetic_policy_death_alpha', 1, v_checklist, v_evidence,
    'hold', 'more_information_needed', '${id.first}');
    raise exception 'changed replay was accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.claimant_record_independent_review('${id.case}', '${id.cycle}',
    '${id.assignment1}', '${id.reviewer1}', 5, 1, 3, 9, 9,
    'synthetic_policy_death_alpha', 1, v_checklist, v_evidence,
    'allow', 'requirements_satisfied', '${id.hostile}');
    raise exception 'same reviewer decided twice';
  exception when serialization_failure then null; end;
  begin perform public.claimant_record_independent_review('${id.case}', '${id.cycle}',
    '${id.assignment2}', '${id.reviewer2}', 5, 1, 3, 9, 9,
    'synthetic_policy_death_alpha', 1, repeat('a', 64), v_evidence,
    'allow', 'requirements_satisfied', '${id.hostile}');
    raise exception 'stale checklist digest was accepted';
  exception when serialization_failure then null; end;
  begin
    update public.claimant_reviewer_assignments set status = 'recused', assignment_version = 2
      where id = '${id.assignment1}';
    begin perform public.claimant_record_independent_review('${id.case}', '${id.cycle}',
      '${id.assignment2}', '${id.reviewer2}', 5, 1, 3, 9, 9,
      'synthetic_policy_death_alpha', 1, v_checklist, v_evidence,
      'allow', 'requirements_satisfied', '${id.hostile}');
      raise exception 'stale first assignment was counted';
    exception when serialization_failure then null; end;
    raise exception 'ROLLBACK_STALE_FIRST' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ROLLBACK_STALE_FIRST' then raise; end if;
  end;
  v_second := public.claimant_record_independent_review('${id.case}', '${id.cycle}',
    '${id.assignment2}', '${id.reviewer2}', 5, 1, 3, 9, 9,
    'synthetic_policy_death_alpha', 1, v_checklist, v_evidence,
    'allow', 'requirements_satisfied', '${id.second}');
  if v_second ->> 'review_status' <> 'two_person_approved'
    or not (v_second ->> 'review_complete')::boolean
    or not (v_second ->> 'two_person_approval_satisfied')::boolean
    or (v_second ->> 'release_authorized')::boolean then
    raise exception 'two-person aggregate was unsafe'; end if;
  if (select count(*) from public.claimant_review_decisions where case_id = '${id.case}') <> 2
    or (select count(*) from public.claimant_review_events where case_id = '${id.case}') <> 3
    or (select state from public.claimant_cases where id = '${id.case}') <> 'cooldown' then
    raise exception 'review atomic records or case isolation failed'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_review_decisions where case_id = '${id.case}';
    raise exception 'authenticated role read review decisions';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role; rollback;
select 'CLAIMANT_INDEPENDENT_REVIEW_DB_TEST_PASSED';`;
}
function runClaimantIndependentReviewDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildClaimantIndependentReviewDbTestSql(options) });
  if (!output.includes("CLAIMANT_INDEPENDENT_REVIEW_DB_TEST_PASSED"))
    throw new Error("Independent-review DB marker was missing.");
}
if (require.main === module) { runClaimantIndependentReviewDbTest();
  console.log("Claimant independent-review DB test passed."); }
module.exports = { buildClaimantIndependentReviewDbTestSql, runClaimantIndependentReviewDbTest };
