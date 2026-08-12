const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const migrationNames = ["20260812210000_claimant_intake_checklist_foundation.sql",
  "20260812220000_claimant_evidence_preparation_metadata.sql",
  "20260812230000_claimant_private_evidence_quarantine.sql",
  "20260813000000_claimant_upload_reconciliation_authority.sql",
  "20260813010000_claimant_submission_acknowledgement.sql"];
const migrations = migrationNames.map((name) => readFileSync(join(__dirname,
  "../supabase/migrations", name), "utf8")).join("\n");

function runClaimantSubmissionDbTest(options = {}) {
  const names = ["owner", "claimant", "other", "session", "otherSession", "invitation", "key",
    "case", "intakeAttempt", "preparationAttempt", "submissionAttempt", "hostileAttempt", "collision"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  const items = ["claimant_photo_identity", "identity_verification_result", "owner_match_reference",
    "official_death_record", "authority_basis", "processing_declaration", "conflict_declaration"];
  const objects = items.map(() => randomUUID());
  const preparedAt = new Date(Date.now() - 60_000).toISOString();
  const checklist = items.map((item_key) => ({ item_key, source: "common", availability: "pending" }));
  const prepared = items.map((item_key, index) => ({ item_key,
    placeholder_ref: `synthetic_evidence_${String(index + 1).padStart(3, "0")}`,
    media_type: "application/pdf", size_bytes: 1024 + index, prepared_at: preparedAt }));
  const manifest = prepared.map(({ item_key, placeholder_ref }) => ({ item_key, placeholder_ref }));
  const declarations = ["information_is_accurate", "evidence_is_lawfully_held",
    "known_conflicts_are_disclosed", "review_is_not_release"];
  const evidenceRows = prepared.map((item, index) => {
    const object = objects[index]; const digest = String(index + 1).repeat(64).slice(0, 64);
    return `insert into public.claimant_evidence_upload_capabilities (id, case_id, claimant_user_id,
      preparation_version, item_key, placeholder_ref, object_path, capability_digest,
      expected_media_type, expected_size_bytes, status, expires_at, consumed_at)
    values ('${object}', '${id.case}', '${id.claimant}', 2, '${item.item_key}',
      '${item.placeholder_ref}', 'v1/${id.case}/${object}', '${digest}', 'application/pdf',
      ${item.size_bytes}, 'consumed', now() + interval '4 minutes', now());
    insert into public.claimant_evidence_objects (id, capability_id, case_id, claimant_user_id,
      item_key, object_path, content_digest, detected_media_type, size_bytes, page_count,
      expanded_size_bytes, status, scan_result, retention_policy_id, delete_after, scanned_at, version)
    values ('${object}', '${object}', '${id.case}', '${id.claimant}', '${item.item_key}',
      'v1/${id.case}/${object}', '${digest}', 'application/pdf', ${item.size_bytes}, 1,
      ${item.size_bytes}, 'clean', 'clean', 'synthetic_retention_30d_v1',
      now() + interval '29 days', now(), 2);`;
  }).join("\n");
  const call = (claimant, session, attempt, submission = "synthetic_submission_alpha_001",
    manifestValue = manifest) => `public.claimant_submit_claim_for_review('${claimant}', '${session}',
      '${id.case}', 2, 9, 2, '${submission}', 'synthetic_policy_death_alpha', 1,
      'synthetic_bundle_alpha_001', $json$${JSON.stringify(manifestValue)}$json$::jsonb,
      $json$${JSON.stringify(declarations)}$json$::jsonb, now(), '${attempt}')`;
  const sql = `
begin;
${migrations}
insert into auth.users (id) values ('${id.owner}'), ('${id.claimant}'), ('${id.other}');
insert into public.claimant_portal_eligibilities (user_id, status, source)
values ('${id.claimant}', 'eligible', 'synthetic_fixture'), ('${id.other}', 'eligible', 'synthetic_fixture');
insert into public.claimant_portal_session_controls (user_id, active_session_id, status, assurance_level, authenticated_at)
values ('${id.claimant}', '${id.session}', 'active', 'aal2', now()),
  ('${id.other}', '${id.otherSession}', 'active', 'aal2', now());
insert into public.claimant_identities (user_id, status) values ('${id.claimant}', 'active'), ('${id.other}', 'active');
insert into public.claimant_invitations (id, owner_user_id, recipient_address_digest, status,
  accepted_by_user_id, expires_at, accepted_at)
values ('${id.invitation}', '${id.owner}', repeat('a', 64), 'accepted', '${id.claimant}',
  now() + interval '1 hour', now());
insert into public.claimant_device_keys (id, claimant_user_id, device_binding_digest, public_key_jwk)
values ('${id.key}', '${id.claimant}', repeat('b', 64),
  '{"kty":"EC","crv":"P-256","x":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","y":"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"}'::jsonb);
insert into public.claimant_cases (id, claimant_user_id, owner_user_id, invitation_id, current_key_id,
  policy_pack_id, policy_pack_version)
values ('${id.case}', '${id.claimant}', '${id.owner}', '${id.invitation}', '${id.key}',
  'synthetic_policy_death_alpha', 1);
set local role service_role;
select public.claimant_initialize_claim_intake('${id.claimant}', '${id.session}', '${id.case}', 1,
  'synthetic_jurisdiction_alpha',
  '{"probate_required":false,"relationship_evidence_required":false,"name_variation_present":false,"translation_required":false,"attestation_required":false,"dispute_known":false}'::jsonb,
  'synthetic_policy_death_alpha', 1, $json$${JSON.stringify(checklist)}$json$::jsonb,
  '${id.intakeAttempt}');
select public.claimant_record_evidence_preparation('${id.claimant}', '${id.session}', '${id.case}',
  2, 1, 'synthetic_policy_death_alpha', 1, 'synthetic_bundle_alpha_001',
  $json$${JSON.stringify(prepared)}$json$::jsonb, '[]'::jsonb, '${id.preparationAttempt}');
${evidenceRows}
update public.claimant_checklist_items set availability = 'available', updated_at = now()
where case_id = '${id.case}';
update public.claimant_intake_snapshots set status = 'ready_for_review', version = 9, updated_at = now()
where case_id = '${id.case}';

do $test$
declare v_result jsonb; v_count integer; v_state text; v_version integer;
begin
  begin
    insert into public.claimant_submission_receipts (case_id, claimant_user_id, submission_ref,
      acknowledgement_ref, submission_digest, case_version, intake_version, preparation_version,
      evidence_object_count, unavailable_item_count, status, review_started, release_authorized,
      claimed_created_at, synthetic_only)
    values ('${id.case}', '${id.other}', 'synthetic_submission_direct_mismatch',
      'synthetic_acknowledgement_${"f".repeat(32)}', repeat('f', 64), 3, 9, 2, 7, 0,
      'received_for_review', false, false, now(), true);
    raise exception 'receipt accepted mismatched claimant ownership';
  exception when foreign_key_violation then null;
  end;
  begin
    perform ${call(id.other, id.otherSession, id.hostileAttempt)};
    raise exception 'cross-claimant submission was accepted';
  exception when insufficient_privilege then null;
  end;
  update public.claimant_case_device_keys set status = 'revoked', revoked_at = now()
  where case_id = '${id.case}' and key_id = '${id.key}';
  begin
    perform ${call(id.claimant, id.session, id.hostileAttempt)};
    raise exception 'revoked claimant key submitted a case';
  exception when insufficient_privilege then null;
  end;
  update public.claimant_case_device_keys set status = 'active', revoked_at = null
  where case_id = '${id.case}' and key_id = '${id.key}';

  update public.claimant_evidence_objects set status = 'scan_failed', scan_result = 'error', scanned_at = now()
  where id = '${objects[0]}';
  begin
    perform ${call(id.claimant, id.session, id.hostileAttempt)};
    raise exception 'non-clean evidence was submitted';
  exception when serialization_failure then null;
  end;
  update public.claimant_evidence_objects set status = 'clean', scan_result = 'clean', scanned_at = now()
  where id = '${objects[0]}';
  begin
    perform ${call(id.claimant, id.session, id.hostileAttempt,
      "synthetic_submission_alpha_001", manifest.slice(1))};
    raise exception 'incomplete evidence manifest was submitted';
  exception when serialization_failure then null;
  end;

  insert into public.claimant_outbox(topic, aggregate_type, aggregate_id, dedupe_key, payload)
  values ('claim_submission_received', 'case', '${id.case}',
    'claim_submission_received:${id.submissionAttempt}', '{"event":"collision"}'::jsonb);
  begin
    perform ${call(id.claimant, id.session, id.submissionAttempt)};
    raise exception 'late outbox collision did not fail';
  exception when unique_violation then null;
  end;
  select state, version into v_state, v_version from public.claimant_cases where id = '${id.case}';
  select count(*) into v_count from public.claimant_submission_receipts where case_id = '${id.case}';
  if v_state <> 'identity_pending' or v_version <> 2 or v_count <> 0
    or exists (select 1 from public.claimant_audit_events where case_id = '${id.case}'
      and event_type = 'claim_submission_received')
    or exists (select 1 from public.claimant_idempotency_records
      where operation = 'submit_claim_for_review' and actor_user_id = '${id.claimant}') then
    raise exception 'late submission failure partially committed';
  end if;
  update public.claimant_outbox set dedupe_key = 'collision-moved:${id.collision}'
  where dedupe_key = 'claim_submission_received:${id.submissionAttempt}';

  v_result := ${call(id.claimant, id.session, id.submissionAttempt)};
  if v_result ->> 'state' <> 'submitted' or v_result ->> 'status' <> 'received_for_review'
    or (v_result ->> 'case_version')::integer <> 3 or (v_result ->> 'intake_version')::integer <> 9
    or (v_result ->> 'preparation_version')::integer <> 2
    or (v_result ->> 'review_started')::boolean or (v_result ->> 'release_authorized')::boolean
    or (v_result ->> 'replayed')::boolean then raise exception 'submission result was unsafe'; end if;
  select state, version into v_state, v_version from public.claimant_cases where id = '${id.case}';
  if v_state <> 'submitted' or v_version <> 3 then raise exception 'case did not advance once'; end if;
  if (select count(*) from public.claimant_submission_receipts where case_id = '${id.case}') <> 1
    or (select count(*) from public.claimant_audit_events where case_id = '${id.case}'
      and event_type = 'claim_submission_received') <> 1
    or (select count(*) from public.claimant_outbox where aggregate_id = '${id.case}'
      and topic = 'claim_submission_received' and payload ->> 'event' = 'claim_submission_received') <> 1 then
    raise exception 'atomic submission records were incomplete';
  end if;
  v_result := ${call(id.claimant, id.session, id.submissionAttempt)};
  if not (v_result ->> 'replayed')::boolean or v_result ->> 'status' <> 'already_received' then
    raise exception 'stable submission replay was not acknowledged';
  end if;
  begin
    perform ${call(id.claimant, id.session, id.submissionAttempt, "synthetic_submission_changed")};
    raise exception 'changed-input replay was accepted';
  exception when invalid_parameter_value then null;
  end;
end
$test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin
    perform ${call(id.claimant, id.session, randomUUID())};
    raise exception 'authenticated role executed claim submission';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.claimant_submission_receipts where case_id = '${id.case}';
    raise exception 'authenticated role read a submission receipt';
  exception when insufficient_privilege then null;
  end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_SUBMISSION_DB_TEST_PASSED';
`;
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: sql });
  if (!output.includes("CLAIMANT_SUBMISSION_DB_TEST_PASSED")) {
    throw new Error("Claimant submission DB test marker was missing.");
  }
}

if (require.main === module) {
  runClaimantSubmissionDbTest(); console.log("Claimant submission DB test passed.");
}
module.exports = { runClaimantSubmissionDbTest };
