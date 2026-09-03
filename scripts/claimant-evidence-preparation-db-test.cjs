const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const DEFAULT_CONTAINER = "supabase_db_supabase";

function runClaimantEvidencePreparationDbTest(options = {}) {
  const id = Object.fromEntries(["owner", "claimant", "other", "session", "otherSession", "invitation",
    "key", "case", "intakeAttempt", "attempt", "invalidAttempt", "staleAttempt", "crossAttempt", "revisionAttempt"]
    .map((name) => [name, randomUUID()]));
  const conditions = { probate_required: true, relationship_evidence_required: false,
    name_variation_present: false, translation_required: false, attestation_required: false,
    dispute_known: false };
  const common = ["claimant_photo_identity", "identity_verification_result", "owner_match_reference",
    "official_death_record", "authority_basis", "processing_declaration", "conflict_declaration"];
  const checklist = [...common.map((item_key) => ({ item_key, source: "common", availability: "pending" })),
    { item_key: "probate_authority", source: "conditional", availability: "pending" }];
  const prepared = [{ item_key: "claimant_photo_identity", placeholder_ref: "synthetic_evidence_001",
    media_type: "application/pdf", size_bytes: 1024, prepared_at: "2026-08-12T10:00:00.000Z" }];
  const revision = [{ item_key: "official_death_record", placeholder_ref: "synthetic_evidence_002",
    media_type: "image/jpeg", size_bytes: 2048, prepared_at: "2026-08-12T10:30:00.000Z" }];
  const sql = `
begin;
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
do $test$
declare v_result jsonb; v_count integer; v_state text; v_case_version integer;
  v_intake_version integer; v_status text; v_availability text;
begin
  v_result := public.claimant_initialize_claim_intake('${id.claimant}', '${id.session}', '${id.case}', 1,
    'synthetic_jurisdiction_alpha', $json$${JSON.stringify(conditions)}$json$::jsonb,
    'synthetic_policy_death_alpha', 1, $json$${JSON.stringify(checklist)}$json$::jsonb,
    '${id.intakeAttempt}');

  begin
    insert into public.claimant_evidence_preparation_items (case_id, preparation_version,
      claimant_user_id, policy_pack_id, policy_pack_version, bundle_ref, item_key, disposition,
      placeholder_ref, media_type, size_bytes, claimed_prepared_at, synthetic_only)
    values ('${id.case}', 2, '${id.other}', 'synthetic_policy_death_alpha', 1,
      'synthetic_bundle_direct', 'claimant_photo_identity', 'prepared', 'synthetic_evidence_direct',
      'application/pdf', 1, now(), true);
    raise exception 'direct evidence metadata changed claimant binding';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.claimant_evidence_preparation_items (case_id, preparation_version,
      claimant_user_id, policy_pack_id, policy_pack_version, bundle_ref, item_key, disposition,
      placeholder_ref, media_type, size_bytes, claimed_prepared_at, synthetic_only)
    values ('${id.case}', 2, '${id.claimant}', 'synthetic_policy_death_alpha', 1,
      'synthetic_bundle_direct', 'claimant_photo_identity', 'prepared', 'synthetic_evidence_direct',
      'application/pdf', 1, now() + interval '1 hour', true);
    raise exception 'direct future evidence timestamp was accepted';
  exception when check_violation then null;
  end;

  begin
    perform public.claimant_record_evidence_preparation('${id.claimant}', '${id.session}', '${id.case}',
      2, 1, 'synthetic_policy_death_alpha', 1, 'synthetic_bundle_invalid',
      '[{"item_key":"dispute_documents","placeholder_ref":"synthetic_evidence_bad","media_type":"application/pdf","size_bytes":1,"prepared_at":"2026-08-12T10:00:00.000Z"}]'::jsonb,
      '[]'::jsonb, '${id.invalidAttempt}');
    raise exception 'unselected checklist item was accepted';
  exception when invalid_parameter_value then null;
  end;
  select count(*) into v_count from public.claimant_evidence_preparation_items where case_id = '${id.case}';
  select version, status into v_intake_version, v_status from public.claimant_intake_snapshots where case_id = '${id.case}';
  if v_count <> 0 or v_intake_version <> 1 or v_status <> 'documents_needed' then
    raise exception 'invalid preparation partially committed';
  end if;

  update public.claimant_case_device_keys set status = 'revoked', revoked_at = now() where case_id = '${id.case}';
  begin
    perform public.claimant_record_evidence_preparation('${id.claimant}', '${id.session}', '${id.case}',
      2, 1, 'synthetic_policy_death_alpha', 1, 'synthetic_bundle_revoked',
      $json$${JSON.stringify(prepared)}$json$::jsonb, '[]'::jsonb, '${id.invalidAttempt}');
    raise exception 'revoked key recorded evidence preparation';
  exception when insufficient_privilege then null;
  end;
  update public.claimant_case_device_keys set status = 'active', revoked_at = null where case_id = '${id.case}';

  begin
    perform public.claimant_record_evidence_preparation('${id.other}', '${id.otherSession}', '${id.case}',
      2, 1, 'synthetic_policy_death_alpha', 1, 'synthetic_bundle_cross',
      $json$${JSON.stringify(prepared)}$json$::jsonb, '[]'::jsonb, '${id.crossAttempt}');
    raise exception 'cross-claimant recorded evidence preparation';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claimant_record_evidence_preparation('${id.claimant}', '${id.otherSession}', '${id.case}',
      2, 1, 'synthetic_policy_death_alpha', 1, 'synthetic_bundle_session',
      $json$${JSON.stringify(prepared)}$json$::jsonb, '[]'::jsonb, '${id.crossAttempt}');
    raise exception 'displaced portal session recorded evidence preparation';
  exception when invalid_authorization_specification then null;
  end;

  v_result := public.claimant_record_evidence_preparation('${id.claimant}', '${id.session}', '${id.case}',
    2, 1, 'synthetic_policy_death_alpha', 1, 'synthetic_bundle_alpha_002',
    $json$${JSON.stringify(prepared)}$json$::jsonb, '["probate_authority"]'::jsonb, '${id.attempt}');
  if (v_result ->> 'intake_version')::integer <> 2
    or (v_result ->> 'prepared_item_count')::integer <> 1
    or (v_result ->> 'unavailable_item_count')::integer <> 1
    or v_result ->> 'status' <> 'manual_review' or (v_result ->> 'replayed')::boolean then
    raise exception 'evidence preparation result was invalid';
  end if;
  select state, version into v_state, v_case_version from public.claimant_cases where id = '${id.case}';
  if v_state <> 'identity_pending' or v_case_version <> 2 then raise exception 'preparation advanced the case'; end if;
  select availability into v_availability from public.claimant_checklist_items
    where case_id = '${id.case}' and item_key = 'claimant_photo_identity';
  if v_availability <> 'pending' then raise exception 'prepared metadata claimed document availability'; end if;
  select availability into v_availability from public.claimant_checklist_items
    where case_id = '${id.case}' and item_key = 'probate_authority';
  if v_availability <> 'not_available' then raise exception 'unavailable item was not recorded'; end if;
  if (select count(*) from public.claimant_audit_events where case_id = '${id.case}'
      and event_type = 'evidence_preparation_recorded') <> 1 then raise exception 'preparation audit was missing'; end if;

  v_result := public.claimant_record_evidence_preparation('${id.claimant}', '${id.session}', '${id.case}',
    2, 1, 'synthetic_policy_death_alpha', 1, 'synthetic_bundle_alpha_002',
    $json$${JSON.stringify(prepared)}$json$::jsonb, '["probate_authority"]'::jsonb, '${id.attempt}');
  if not (v_result ->> 'replayed')::boolean then raise exception 'stable replay was not returned'; end if;
  begin
    perform public.claimant_record_evidence_preparation('${id.claimant}', '${id.session}', '${id.case}',
      2, 1, 'synthetic_policy_death_alpha', 1, 'synthetic_bundle_changed',
      $json$${JSON.stringify(prepared)}$json$::jsonb, '["probate_authority"]'::jsonb, '${id.attempt}');
    raise exception 'changed-input replay was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.claimant_record_evidence_preparation('${id.claimant}', '${id.session}', '${id.case}',
      2, 1, 'synthetic_policy_death_alpha', 1, 'synthetic_bundle_stale',
      $json$${JSON.stringify(prepared)}$json$::jsonb, '[]'::jsonb, '${id.staleAttempt}');
    raise exception 'stale intake version was accepted';
  exception when serialization_failure then null;
  end;

  v_result := public.claimant_record_evidence_preparation('${id.claimant}', '${id.session}', '${id.case}',
    2, 2, 'synthetic_policy_death_alpha', 1, 'synthetic_bundle_revision',
    $json$${JSON.stringify(revision)}$json$::jsonb, '[]'::jsonb, '${id.revisionAttempt}');
  if (v_result ->> 'intake_version')::integer <> 3 or v_result ->> 'status' <> 'documents_needed' then
    raise exception 'evidence preparation revision failed';
  end if;
  select count(*) into v_count from public.claimant_evidence_preparation_items where case_id = '${id.case}';
  if v_count <> 3 then raise exception 'append-only preparation history was not retained'; end if;
  select availability into v_availability from public.claimant_checklist_items
    where case_id = '${id.case}' and item_key = 'probate_authority';
  if v_availability <> 'pending' then raise exception 'revision did not reset current checklist projection'; end if;
end
$test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin
    perform public.claimant_record_evidence_preparation('${id.claimant}', '${id.session}', '${id.case}',
      2, 3, 'synthetic_policy_death_alpha', 1, 'synthetic_bundle_denied', '[]'::jsonb,
      '["authority_basis"]'::jsonb, gen_random_uuid());
    raise exception 'authenticated role executed evidence preparation function';
  exception when insufficient_privilege then null;
  end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_EVIDENCE_PREPARATION_DB_TEST_PASSED';
`;
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: sql });
  if (!output.includes("CLAIMANT_EVIDENCE_PREPARATION_DB_TEST_PASSED")) {
    throw new Error("Claimant evidence preparation DB test marker was missing.");
  }
}

if (require.main === module) {
  runClaimantEvidencePreparationDbTest();
  console.log("Claimant evidence preparation DB test passed.");
}
module.exports = { runClaimantEvidencePreparationDbTest };
