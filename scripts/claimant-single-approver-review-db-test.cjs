const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const policy = "synthetic_policy_single_alpha";

/*
 * Slice 7A: the single-approver path end to end on the full migrated schema, and every way it must refuse.
 * Time is simulated only by moving the dispute window's own timestamps back, as the service role.
 */
function buildClaimantSingleApproverReviewDbTestSql() {
  const names = ["case", "cycle", "owner", "claimant", "approverUser", "actorUser", "nokUser", "strangerUser",
    "otherAuthorityUser", "invitation", "nokInvitation", "key1", "key2", "grant1", "grant2", "capability",
    "approver", "actor", "assignment", "authority", "otherAuthority"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  const key = () => `'${randomUUID()}'`;
  const run = (phase) => `public.claimant_run_review_precheck('${id.case}', '${id.cycle}', '${phase}', 5, ${key()})`;
  const decide = (precheck, decision, reason, reviewer = id.approver) =>
    `public.claimant_record_single_approver_decision('${id.case}', '${id.cycle}', '${id.assignment}',
      '${reviewer}', ${precheck}, 5, 1, 3, 9, 9, '${policy}', 1, v_checklist, v_evidence,
      '${decision}', '${reason}', v_decision_key)`;
  const release = (authority, precheck, assuredAt = "now()", idem = "v_release_key") =>
    `public.claimant_authorize_single_approver_release('${id.case}', '${id.cycle}', v_round, '${authority}',
      ${precheck}, 5, 2, 2, 1, v_window_version, ${assuredAt}, ${idem})`;
  const expectFailure = (label, statement, condition) => `
  begin ${statement};
    raise exception '${label}';
  exception when ${condition} then null; end;`;
  const rolledBack = (marker, body) => `
  begin
    ${body}
    raise exception '${marker}' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '${marker}' then raise; end if;
  end;`;
  return `begin;
insert into auth.users(id) values ('${id.owner}'), ('${id.claimant}'), ('${id.approverUser}'),
  ('${id.actorUser}'), ('${id.nokUser}'), ('${id.strangerUser}'), ('${id.otherAuthorityUser}');
insert into public.claimant_identities(user_id, status) values ('${id.claimant}', 'active'),
  ('${id.nokUser}', 'active');
insert into public.claimant_invitations(id, owner_user_id, recipient_address_digest, status,
  accepted_by_user_id, expires_at, accepted_at)
values ('${id.invitation}', '${id.owner}', repeat('a', 64), 'accepted', '${id.claimant}',
    now() + interval '1 day', now()),
  ('${id.nokInvitation}', '${id.owner}', repeat('9', 64), 'accepted', '${id.nokUser}',
    now() + interval '1 day', now());
insert into public.claimant_device_keys(id, claimant_user_id, device_binding_digest, public_key_jwk)
values ('${id.key1}', '${id.claimant}', repeat('b', 64),
    jsonb_build_object('kty','EC','crv','P-256','x',repeat('A',43),'y',repeat('B',43))),
  ('${id.key2}', '${id.claimant}', repeat('c', 64),
    jsonb_build_object('kty','EC','crv','P-256','x',repeat('C',43),'y',repeat('D',43)));
insert into public.claimant_cases(id, claimant_user_id, owner_user_id, invitation_id,
  current_key_id, state, policy_pack_id, policy_pack_version, version, binding_version,
  finalization_version, owner_finalized_at)
values ('${id.case}', '${id.claimant}', '${id.owner}', '${id.invitation}', '${id.key1}',
  'cooldown', '${policy}', 1, 5, 2, 1, now());
insert into public.claimant_intake_snapshots(case_id, claimant_user_id, synthetic_only,
  jurisdiction_key, trigger_type, routing_conditions, policy_pack_id, policy_pack_version, status, version)
values ('${id.case}', '${id.claimant}', true, 'synthetic_jurisdiction_alpha', 'death',
  '{"probate_required":false,"relationship_evidence_required":false,"name_variation_present":false,
  "translation_required":false,"attestation_required":false,"dispute_known":false}'::jsonb,
  '${policy}', 1, 'ready_for_review', 9);
insert into public.claimant_checklist_items(case_id, item_key, source, availability) values
  ('${id.case}', 'claimant_photo_identity', 'common', 'available'),
  ('${id.case}', 'official_death_record', 'common', 'available');
insert into public.claimant_evidence_preparation_items(case_id, preparation_version,
  claimant_user_id, policy_pack_id, policy_pack_version, bundle_ref, item_key, disposition,
  placeholder_ref, media_type, size_bytes, claimed_prepared_at, synthetic_only)
values ('${id.case}', 9, '${id.claimant}', '${policy}', 1, 'synthetic_bundle_single',
  'claimant_photo_identity', 'prepared', 'synthetic_evidence_single', 'application/pdf', 1024,
  now() - interval '1 minute', true);
insert into public.claimant_evidence_upload_capabilities(id, case_id, claimant_user_id,
  preparation_version, item_key, placeholder_ref, object_path, capability_digest,
  expected_media_type, expected_size_bytes, status, expires_at, consumed_at)
values ('${id.capability}', '${id.case}', '${id.claimant}', 9, 'claimant_photo_identity',
  'synthetic_evidence_single', 'v1/${id.case}/${id.capability}', repeat('c', 64),
  'application/pdf', 1024, 'consumed', now() + interval '5 minutes', now());
insert into public.claimant_evidence_objects(id, capability_id, case_id, claimant_user_id,
  item_key, object_path, content_digest, detected_media_type, size_bytes, page_count,
  expanded_size_bytes, status, scan_result, retention_policy_id, delete_after, scanned_at, version)
values ('${id.capability}', '${id.capability}', '${id.case}', '${id.claimant}',
  'claimant_photo_identity', 'v1/${id.case}/${id.capability}', repeat('e', 64),
  'application/pdf', 1024, 1, 1024, 'clean', 'clean', 'synthetic_retention_30d_v1',
  now() + interval '30 days', now(), 2);
insert into public.claimant_submission_receipts(case_id, claimant_user_id, synthetic_only,
  submission_ref, acknowledgement_ref, submission_digest, case_version, intake_version,
  preparation_version, evidence_object_count, unavailable_item_count, status, review_started,
  release_authorized, claimed_created_at)
values ('${id.case}', '${id.claimant}', true, 'synthetic_submission_single',
  'synthetic_acknowledgement_${"a".repeat(32)}', repeat('d', 64), 3, 9, 9, 1, 0,
  'received_for_review', false, false, now() - interval '40 days');
insert into public.claimant_owner_protection_cycles(id, case_id, owner_user_id,
  claimant_user_id, policy_pack_id, policy_pack_version, submission_case_version,
  cycle_number, notice_ref, status, cooldown_seconds, delivery_evidence_digest,
  delivery_verified_at, cooldown_started_at, cooldown_expires_at)
values ('${id.cycle}', '${id.case}', '${id.owner}', '${id.claimant}', '${policy}', 1, 3, 1,
  'synthetic_owner_notice_single', 'delivery_verified', 2592000, repeat('f', 64),
  now() - interval '31 days', now() - interval '31 days', now() - interval '1 day');
insert into public.claimant_review_policies(policy_pack_id, policy_pack_version, review_mode,
  min_cooldown_seconds, dispute_window_seconds)
values ('${policy}', 1, 'single_approver', 2592000, 604800);
insert into public.claimant_reviewer_identities(id, user_id, pseudonymous_ref, reviewer_class)
values ('${id.approver}', '${id.approverUser}', 'synthetic_reviewer_single_approver', 'accountable_human_test'),
  ('${id.actor}', '${id.actorUser}', 'synthetic_reviewer_single_actor', 'non_human_test_actor');
insert into public.claimant_reviewer_assignments(id, case_id, cycle_id,
  reviewer_identity_id, assignment_slot, assigned_case_version, cycle_number, status)
values ('${id.assignment}', '${id.case}', '${id.cycle}', '${id.approver}', 1, 5, 1, 'assigned');
insert into public.claimant_case_device_keys(case_id, key_id, claimant_user_id)
values ('${id.case}', '${id.key2}', '${id.claimant}');
insert into public.claimant_recipient_grants(id, case_id, owner_user_id, claimant_user_id,
  recipient_key_id, recipient_key_version, protocol, profile, key_agreement, kdf, aead,
  owner_ephemeral_public_key, nonce, ciphertext, grant_version, status, created_at)
values ('${id.grant1}', '${id.case}', '${id.owner}', '${id.claimant}', '${id.key1}', 1,
    'sanduqkin:claim:recipient-grant:v2', 'registered_recipient_v2', 'p256_ecdh',
    'hkdf_sha256', 'xchacha20poly1305_ietf', repeat('E', 87), repeat('N', 32), repeat('G', 64), 1,
    'active', now()),
  ('${id.grant2}', '${id.case}', '${id.owner}', '${id.claimant}', '${id.key2}', 1,
    'sanduqkin:claim:recipient-grant:v2', 'registered_recipient_v2', 'p256_ecdh',
    'hkdf_sha256', 'xchacha20poly1305_ietf', repeat('F', 87), repeat('M', 32), repeat('H', 64), 1,
    'active', now());
insert into public.claimant_release_authority_identities(id, user_id, pseudonymous_ref, authority_class)
values ('${id.authority}', '${id.approverUser}', 'synthetic_release_authority_single_approver',
    'release_test_authorizer'),
  ('${id.otherAuthority}', '${id.otherAuthorityUser}', 'synthetic_release_authority_single_other',
    'release_test_authorizer');
set local role service_role;
do $test$
declare
  v_checklist text; v_evidence text; v_precheck jsonb; v_blocking jsonb; v_result jsonb;
  v_round uuid; v_window_version integer; v_release_precheck uuid;
  v_decision_key uuid := '${randomUUID()}'; v_release_key uuid := '${randomUUID()}';
begin
  select encode(extensions.digest(string_agg(item_key || ':' || availability, '|' order by item_key),
    'sha256'), 'hex') into v_checklist from public.claimant_checklist_items where case_id = '${id.case}';
  select encode(extensions.digest(string_agg(object.id::text || ':' || object.version::text || ':'
    || object.content_digest, '|' order by object.id::text), 'sha256'), 'hex') into v_evidence
  from public.claimant_evidence_objects object where object.case_id = '${id.case}';

  -- No decision without a pre-check, and the two-person path cannot open a round for a single-approver case.
  ${expectFailure("decision without precheck was accepted",
    `perform ${decide(`'${randomUUID()}'`, "allow", "requirements_satisfied")}`, "serialization_failure")}
  ${expectFailure("two-person round opened for a single-approver policy",
    `perform public.claimant_record_independent_review('${id.case}', '${id.cycle}', '${id.assignment}',
      '${id.approver}', 5, 1, 3, 9, 9, '${policy}', 1, v_checklist, v_evidence, 'allow',
      'requirements_satisfied', '${randomUUID()}')`, "insufficient_privilege")}

  -- A cooldown shorter than the single-approver minimum blocks, and a blocking pre-check cannot be overridden.
  ${rolledBack("ROLLBACK_SHORT_COOLDOWN", `
    update public.claimant_owner_protection_cycles set cooldown_seconds = 86400,
      delivery_verified_at = now() - interval '2 days', cooldown_started_at = now() - interval '2 days',
      cooldown_expires_at = now() - interval '1 day' where id = '${id.cycle}';
    v_blocking := ${run("decision")};
    if v_blocking ->> 'outcome' <> 'blocking'
      or (v_blocking #>> '{results,cooldown_meets_minimum}')::boolean then
      raise exception 'short cooldown did not block'; end if;
    ${expectFailure("blocking precheck was overridden",
      `perform ${decide("(v_blocking ->> 'precheck_id')::uuid", "allow", "requirements_satisfied")}`,
      "serialization_failure")}`)}

  -- A blocking pre-check alone stops an approval, even when nothing else the decision checks has changed.
  ${rolledBack("ROLLBACK_BLOCKING_ONLY", `
    update public.claimant_recipient_grants set status = 'revoked', revoked_at = now()
    where id = '${id.grant2}';
    v_blocking := ${run("decision")};
    if v_blocking ->> 'outcome' <> 'blocking' then raise exception 'revoked grant did not block'; end if;
    ${expectFailure("blocking precheck was overridden",
      `perform ${decide("(v_blocking ->> 'precheck_id')::uuid", "allow", "requirements_satisfied")}`,
      "serialization_failure")}
    v_result := ${decide("(v_blocking ->> 'precheck_id')::uuid", "hold", "more_information_needed")};
    if v_result ->> 'review_status' <> 'held' or v_result ->> 'dispute_window_status' is not null then
      raise exception 'hold after blocking precheck was unsafe'; end if;`)}

  v_precheck := ${run("decision")};
  if v_precheck ->> 'outcome' <> 'clear' or exists (select 1 from jsonb_each(v_precheck -> 'results') entry
    where entry.value <> 'true'::jsonb) or (v_precheck ->> 'release_authorized')::boolean then
    raise exception 'decision precheck was not clear: %', v_precheck; end if;

  -- Only the accountable human may decide.
  ${rolledBack("ROLLBACK_NON_HUMAN", `
    update public.claimant_reviewer_identities set reviewer_class = 'non_human_test_actor'
    where id = '${id.approver}';
    ${expectFailure("non-human approver was accepted",
      `perform ${decide("(v_precheck ->> 'precheck_id')::uuid", "allow", "requirements_satisfied")}`,
      "serialization_failure")}`)}

  v_result := ${decide("(v_precheck ->> 'precheck_id')::uuid", "allow", "requirements_satisfied")};
  if v_result ->> 'review_status' <> 'single_approved' or v_result ->> 'review_mode' <> 'single_approver'
    or v_result ->> 'dispute_window_status' <> 'awaiting_notice'
    or (v_result ->> 'release_authorized')::boolean or (v_result ->> 'round_version')::integer <> 2 then
    raise exception 'single approval result was unsafe: %', v_result; end if;
  v_round := (v_result ->> 'review_round_id')::uuid;
  if not (${decide("(v_precheck ->> 'precheck_id')::uuid", "allow", "requirements_satisfied")}
    ->> 'replayed')::boolean then raise exception 'decision replay was unstable'; end if;
  ${expectFailure("changed decision replay was accepted",
    `perform ${decide("(v_precheck ->> 'precheck_id')::uuid", "hold", "more_information_needed")}`,
    "invalid_parameter_value")}
  if (select count(*) from public.claimant_review_decisions where review_round_id = v_round) <> 1 then
    raise exception 'single approval recorded more than one decision'; end if;

  -- No release before the approval notice is delivered and the window has run its course.
  select window_version into v_window_version from public.claimant_single_approval_windows
  where review_round_id = v_round;
  v_blocking := ${run("release")};
  if v_blocking ->> 'outcome' <> 'blocking' then raise exception 'release precheck cleared too early'; end if;
  ${expectFailure("release before notice was accepted",
    `perform ${release(id.authority, "(v_blocking ->> 'precheck_id')::uuid")}`, "insufficient_privilege")}
  v_result := public.claimant_record_approval_notice_delivery('${id.case}', v_round, v_window_version,
    'verified', repeat('7', 64), '${randomUUID()}');
  if v_result ->> 'dispute_window_status' <> 'open' then raise exception 'notice did not open the window'; end if;
  v_window_version := (v_result ->> 'window_version')::integer;
  v_blocking := ${run("release")};
  if v_blocking ->> 'outcome' <> 'blocking'
    or (v_blocking #>> '{results,dispute_window_elapsed}')::boolean then
    raise exception 'release precheck ignored the running window'; end if;

  -- During the window: a stranger cannot hold it; another next of kin, the owner and the claimant can.
  ${expectFailure("stranger held the approval",
    `perform public.claimant_hold_single_approval('${id.case}', v_round, v_window_version, 'next_of_kin',
      '${id.strangerUser}', 'next_of_kin_dispute', '${randomUUID()}')`, "insufficient_privilege")}
  ${rolledBack("ROLLBACK_NEXT_OF_KIN_HOLD", `
    v_result := public.claimant_hold_single_approval('${id.case}', v_round, v_window_version, 'next_of_kin',
      '${id.nokUser}', 'next_of_kin_dispute', '${randomUUID()}');
    update public.claimant_single_approval_windows set window_started_at = now() - interval '8 days',
      window_expires_at = now() - interval '1 day' where review_round_id = v_round;
    v_release_precheck := (${run("release")} ->> 'precheck_id')::uuid;
    ${expectFailure("held approval was released",
      `perform ${release(id.authority, "v_release_precheck", "now()", `'${randomUUID()}'`)}`,
      "insufficient_privilege")}`)}
  ${rolledBack("ROLLBACK_OWNER_CANCEL", `
    perform public.claimant_stop_owner_protection('${id.case}', '${id.cycle}', 5, 'owner_cancelled',
      '${id.owner}', '${randomUUID()}');
    ${expectFailure("owner-cancelled approval was released",
      `perform ${release(id.authority, "(v_blocking ->> 'precheck_id')::uuid", "now()", `'${randomUUID()}'`)}`,
      "insufficient_privilege")}`)}

  -- The window elapses undisturbed.
  update public.claimant_single_approval_windows set window_started_at = now() - interval '8 days',
    window_expires_at = now() - interval '1 day' where review_round_id = v_round;

  -- A key or grant change after approval blocks the release pre-check.
  ${rolledBack("ROLLBACK_GRANT_CHANGE", `
    update public.claimant_recipient_grants set status = 'revoked', revoked_at = now()
    where id = '${id.grant2}';
    v_blocking := ${run("release")};
    if v_blocking ->> 'outcome' <> 'blocking'
      or (v_blocking #>> '{results,recipient_keys_current}')::boolean then
      raise exception 'grant change did not block release'; end if;`)}

  v_release_precheck := (${run("release")} ->> 'precheck_id')::uuid;
  if (select outcome from public.claimant_review_prechecks where id = v_release_precheck) <> 'clear' then
    raise exception 'release precheck was not clear'; end if;
  ${expectFailure("stale re-confirmation was accepted",
    `perform ${release(id.authority, "v_release_precheck", "now() - interval '20 minutes'", `'${randomUUID()}'`)}`,
    "insufficient_privilege")}
  ${expectFailure("a different authorizer released the approval",
    `perform ${release(id.otherAuthority, "v_release_precheck", "now()", `'${randomUUID()}'`)}`,
    "insufficient_privilege")}
  ${expectFailure("a decision pre-check was used for release",
    `perform ${release(id.authority, "(v_precheck ->> 'precheck_id')::uuid", "now()", `'${randomUUID()}'`)}`,
    "insufficient_privilege")}

  v_result := ${release(id.authority, "v_release_precheck")};
  if v_result ->> 'case_state' <> 'approved' or v_result ->> 'review_mode' <> 'single_approver'
    or not (v_result ->> 'release_authorized')::boolean
    or (v_result ->> 'package_creation_authorized')::boolean
    or (v_result ->> 'retrieval_authorized')::boolean or (v_result ->> 'case_version')::integer <> 6 then
    raise exception 'single approver release result was unsafe: %', v_result; end if;
  if not (${release(id.authority, "v_release_precheck")} ->> 'replayed')::boolean then
    raise exception 'release replay was unstable'; end if;
  if (select review_mode from public.claimant_release_authorizations where case_id = '${id.case}')
      <> 'single_approver'
    or (select status from public.claimant_single_approval_windows where review_round_id = v_round) <> 'closed'
    or (select count(*) from public.claimant_release_authorizations where case_id = '${id.case}') <> 1 then
    raise exception 'single approver release records were wrong'; end if;

  -- The audit chain covers every step and verifies; the export carries no reasons or evidence.
  v_result := public.claimant_verify_review_audit_chain('${id.case}');
  if not (v_result ->> 'verified')::boolean or (v_result ->> 'entries')::integer < 8 then
    raise exception 'audit chain did not verify: %', v_result; end if;
  v_result := public.claimant_export_review_audit('${id.case}');
  if not (v_result ->> 'verified')::boolean
    or v_result::text ~ '(reason_class|requirements_satisfied|content_digest|evidence|grant|${id.approverUser})' then
    raise exception 'audit export was unsafe: %', v_result; end if;
end $test$;
reset role;
do $tamper$
declare v_event uuid;
begin
  begin
    update public.claimant_single_approval_events set outcome_class = 'blocking'
    where case_id = '${id.case}' and event_type = 'review_precheck_recorded' and outcome_class = 'clear';
    if (public.claimant_verify_review_audit_chain('${id.case}') ->> 'verified')::boolean then
      raise exception 'edited event was not detected'; end if;
    raise exception 'ROLLBACK_TAMPER_EDIT' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_TAMPER_EDIT' then raise; end if; end;
  begin
    delete from public.claimant_review_audit_chain where case_id = '${id.case}'
      and sequence = (select max(sequence) from public.claimant_review_audit_chain
        where case_id = '${id.case}');
    if (public.claimant_verify_review_audit_chain('${id.case}') ->> 'verified')::boolean then
      raise exception 'deleted chain entry was not detected'; end if;
    raise exception 'ROLLBACK_TAMPER_DELETE' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_TAMPER_DELETE' then raise; end if; end;
  if not (public.claimant_verify_review_audit_chain('${id.case}') ->> 'verified')::boolean then
    raise exception 'untampered chain did not verify'; end if;
end $tamper$;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_review_prechecks;
    raise exception 'authenticated role read prechecks';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_run_review_precheck('${id.case}', '${id.cycle}', 'decision', 5,
    '${randomUUID()}');
    raise exception 'authenticated role ran a precheck';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_verify_review_audit_chain('${id.case}');
    raise exception 'authenticated role read the audit chain';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role; rollback;
select 'CLAIMANT_SINGLE_APPROVER_REVIEW_DB_TEST_PASSED';`;
}

function runClaimantSingleApproverReviewDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildClaimantSingleApproverReviewDbTestSql() });
  if (!output.includes("CLAIMANT_SINGLE_APPROVER_REVIEW_DB_TEST_PASSED"))
    throw new Error("Single-approver review DB marker was missing.");
}

if (require.main === module) {
  const flag = process.argv.indexOf("--container");
  runClaimantSingleApproverReviewDbTest({ container: flag >= 0 ? process.argv[flag + 1] : undefined });
  console.log("Claimant single-approver review DB test passed.");
}

module.exports = { buildClaimantSingleApproverReviewDbTestSql, runClaimantSingleApproverReviewDbTest };
