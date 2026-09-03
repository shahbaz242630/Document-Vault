const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const migrationNames = ["20260804134000_claimant_registered_recipient_foundation.sql",
  "20260804150000_claimant_registered_recipient_mutations.sql",
  "20260804170000_claimant_session_assurance.sql",
  "20260804190000_claimant_registered_recipient_lifecycle.sql",
  "20260804210000_claimant_portal_session_boundary.sql",
  "20260812130000_claimant_app_attest_persistence.sql",
  "20260812150000_claimant_native_enrollment_challenges.sql",
  "20260812170000_claimant_native_enrollment_controller_authority.sql",
  "20260812190000_claimant_native_enrollment_reconciliation.sql",
  "20260812210000_claimant_intake_checklist_foundation.sql",
  "20260812220000_claimant_evidence_preparation_metadata.sql",
  "20260812230000_claimant_private_evidence_quarantine.sql",
  "20260813000000_claimant_upload_reconciliation_authority.sql",
  "20260813010000_claimant_submission_acknowledgement.sql",
  "20260818010000_claimant_owner_protection_foundation.sql",
  "20260818075248_claimant_owner_notice_delivery_queue.sql",
  "20260818120000_claimant_reviewer_assignment_foundation.sql"];

function migrations() { return migrationNames.map((name) => readFileSync(join(__dirname,
  "../supabase/migrations", name), "utf8")).join("\n"); }

function buildClaimantReviewerAssignmentDbTestSql(options = {}) {
  const names = ["owner", "claimant", "reviewer1User", "reviewer2User", "reviewer3User",
    "invitation", "key", "case", "cycle", "reviewer1", "reviewer2", "reviewer3",
    "ownerReviewer", "claimantReviewer", "assign1", "assign2", "assign3", "conflict",
    "recuse", "hostile", "otherCase"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  return `begin;
${options.includeMigrations ? migrations() : ""}
insert into auth.users (id) values ('${id.owner}'), ('${id.claimant}'),
  ('${id.reviewer1User}'), ('${id.reviewer2User}'), ('${id.reviewer3User}');
insert into public.claimant_identities (user_id, status) values ('${id.claimant}', 'active');
insert into public.claimant_invitations (id, owner_user_id, recipient_address_digest, status,
  accepted_by_user_id, expires_at, accepted_at)
values ('${id.invitation}', '${id.owner}', repeat('a', 64), 'accepted', '${id.claimant}',
  now() + interval '1 hour', now());
insert into public.claimant_device_keys (id, claimant_user_id, device_binding_digest, public_key_jwk)
values ('${id.key}', '${id.claimant}', repeat('b', 64),
  '{"kty":"EC","crv":"P-256","x":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","y":"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"}'::jsonb);
insert into public.claimant_cases (id, claimant_user_id, owner_user_id, invitation_id,
  current_key_id, state, policy_pack_id, policy_pack_version, version)
values ('${id.case}', '${id.claimant}', '${id.owner}', '${id.invitation}', '${id.key}',
  'cooldown', 'synthetic_policy_death_alpha', 1, 5);
insert into public.claimant_submission_receipts (case_id, claimant_user_id, submission_ref,
  acknowledgement_ref, submission_digest, case_version, intake_version, preparation_version,
  evidence_object_count, unavailable_item_count, status, review_started, release_authorized,
  claimed_created_at, synthetic_only)
values ('${id.case}', '${id.claimant}', 'synthetic_submission_alpha_001',
  'synthetic_acknowledgement_${"a".repeat(32)}', repeat('c', 64), 3, 9, 2, 1, 0,
  'received_for_review', false, false, now(), true);
insert into public.claimant_owner_protection_cycles (id, case_id, owner_user_id,
  claimant_user_id, policy_pack_id, policy_pack_version, submission_case_version,
  cycle_number, notice_ref, status, cooldown_seconds, delivery_evidence_digest,
  delivery_verified_at, cooldown_started_at, cooldown_expires_at, updated_at)
values ('${id.cycle}', '${id.case}', '${id.owner}', '${id.claimant}',
  'synthetic_policy_death_alpha', 1, 3, 1, 'synthetic_owner_notice_alpha_001',
  'delivery_verified', 86400, repeat('d', 64), now() - interval '2 days',
  now() - interval '2 days', now() - interval '1 day', now());
insert into public.claimant_reviewer_identities
  (id, user_id, pseudonymous_ref, reviewer_class) values
  ('${id.reviewer1}', '${id.reviewer1User}', 'synthetic_reviewer_human_alpha',
    'accountable_human_test'),
  ('${id.reviewer2}', '${id.reviewer2User}', 'synthetic_reviewer_codex_alpha',
    'non_human_test_actor'),
  ('${id.reviewer3}', '${id.reviewer3User}', 'synthetic_reviewer_human_beta',
    'accountable_human_test'),
  ('${id.ownerReviewer}', '${id.owner}', 'synthetic_reviewer_related_owner',
    'accountable_human_test'),
  ('${id.claimantReviewer}', '${id.claimant}', 'synthetic_reviewer_related_claimant',
    'accountable_human_test');
set local role service_role;
do $test$
declare v_first jsonb; v_second jsonb; v_third jsonb; v_result jsonb;
begin
  v_first := public.claimant_assign_reviewer('${id.case}', '${id.cycle}', 5,
    '${id.reviewer1}', 1, '${id.assign1}');
  if v_first ->> 'status' <> 'assigned' or (v_first ->> 'assignment_slot')::integer <> 1
    or (v_first ->> 'reviewer_decision_recorded')::boolean
    or (v_first ->> 'approval_counted')::boolean
    or (v_first ->> 'release_authorized')::boolean then
    raise exception 'first reviewer assignment returned unsafe authority';
  end if;
  if not (public.claimant_assign_reviewer('${id.case}', '${id.cycle}', 5,
    '${id.reviewer1}', 1, '${id.assign1}') ->> 'replayed')::boolean then
    raise exception 'assignment replay was unstable';
  end if;
  begin
    perform public.claimant_assign_reviewer('${id.case}', '${id.cycle}', 5,
      '${id.reviewer1}', 2, '${id.assign1}');
    raise exception 'changed assignment replay was accepted';
  exception when invalid_parameter_value then null; end;
  v_second := public.claimant_assign_reviewer('${id.case}', '${id.cycle}', 5,
    '${id.reviewer2}', 2, '${id.assign2}');
  begin
    perform public.claimant_assign_reviewer('${id.case}', '${id.cycle}', 5,
      '${id.reviewer1}', 2, '${id.hostile}');
    raise exception 'same reviewer occupied both slots';
  exception when serialization_failure then null; end;
  begin
    perform public.claimant_assign_reviewer('${id.case}', '${id.cycle}', 5,
      '${id.reviewer3}', 1, '${id.hostile}');
    raise exception 'active slot accepted a duplicate reviewer';
  exception when serialization_failure then null; end;
  begin
    perform public.claimant_assign_reviewer('${id.case}', '${id.cycle}', 5,
      '${id.ownerReviewer}', 1, '${id.hostile}');
    raise exception 'owner was assigned as reviewer';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claimant_assign_reviewer('${id.case}', '${id.cycle}', 5,
      '${id.claimantReviewer}', 1, '${id.hostile}');
    raise exception 'claimant was assigned as reviewer';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claimant_declare_reviewer_conflict('${id.otherCase}',
      (v_first ->> 'assignment_id')::uuid, '${id.reviewer1}', 5, 1,
      'owner_relationship', '${id.hostile}');
    raise exception 'cross-case conflict was accepted';
  exception when serialization_failure then null; end;
  v_result := public.claimant_declare_reviewer_conflict('${id.case}',
    (v_first ->> 'assignment_id')::uuid, '${id.reviewer1}', 5, 1,
    'owner_relationship', '${id.conflict}');
  if v_result ->> 'status' <> 'conflicted' or (v_result ->> 'assignment_version')::integer <> 2
    or v_result ->> 'reason_class' <> 'owner_relationship'
    or (v_result ->> 'approval_counted')::boolean then
    raise exception 'conflict result was unsafe';
  end if;
  begin
    perform public.claimant_declare_reviewer_conflict('${id.case}',
      (v_first ->> 'assignment_id')::uuid, '${id.reviewer1}', 5, 1,
      'other_conflict', '${id.hostile}');
    raise exception 'stale assignment version declared conflict';
  exception when serialization_failure then null; end;
  v_result := public.claimant_recuse_reviewer('${id.case}',
    (v_second ->> 'assignment_id')::uuid, '${id.reviewer2}', 5, 1,
    'availability', '${id.recuse}');
  if v_result ->> 'status' <> 'recused' or v_result ->> 'reason_class' <> 'availability'
    or (v_result ->> 'reviewer_decision_recorded')::boolean then
    raise exception 'recusal result was unsafe';
  end if;
  v_third := public.claimant_assign_reviewer('${id.case}', '${id.cycle}', 5,
    '${id.reviewer3}', 1, '${id.assign3}');
  if v_third ->> 'status' <> 'assigned' then raise exception 'safe reassignment failed'; end if;
  if (select count(*) from public.claimant_reviewer_assignments
      where case_id = '${id.case}') <> 3
    or (select count(*) from public.claimant_reviewer_assignment_events
      where case_id = '${id.case}') <> 5
    or (select count(*) from public.claimant_reviewer_assignment_idempotency
      where case_id = '${id.case}') <> 5 then
    raise exception 'reviewer assignment records were incomplete';
  end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform public.claimant_assign_reviewer('${id.case}', '${id.cycle}', 5,
    '${id.reviewer3}', 2, '${id.hostile}');
    raise exception 'authenticated role assigned a reviewer';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.claimant_reviewer_assignments where case_id = '${id.case}';
    raise exception 'authenticated role read reviewer assignments';
  exception when insufficient_privilege then null; end;
  begin update public.claimant_reviewer_assignment_events set metadata = '{}';
    raise exception 'authenticated role changed reviewer events';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_REVIEWER_ASSIGNMENT_DB_TEST_PASSED' as result;`;
}

function runClaimantReviewerAssignmentDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildClaimantReviewerAssignmentDbTestSql(options) });
  if (!output.includes("CLAIMANT_REVIEWER_ASSIGNMENT_DB_TEST_PASSED")) {
    throw new Error("Claimant reviewer-assignment DB test marker was missing.");
  }
}

if (process.argv.includes("--emit-hosted-sql")) {
  process.stdout.write(buildClaimantReviewerAssignmentDbTestSql({ includeMigrations: true }));
} else if (require.main === module) {
  runClaimantReviewerAssignmentDbTest();
  console.log("Claimant reviewer-assignment DB test passed.");
}
module.exports = { buildClaimantReviewerAssignmentDbTestSql,
  runClaimantReviewerAssignmentDbTest };
