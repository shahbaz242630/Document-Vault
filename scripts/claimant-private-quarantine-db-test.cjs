const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const migrations = ["20260812210000_claimant_intake_checklist_foundation.sql",
  "20260812220000_claimant_evidence_preparation_metadata.sql",
  "20260812230000_claimant_private_evidence_quarantine.sql",
  "20260813000000_claimant_upload_reconciliation_authority.sql"]
  .map((name) => readFileSync(join(__dirname, "../supabase/migrations", name), "utf8")).join("\n");

function runClaimantPrivateQuarantineDbTest(options = {}) {
  const names = ["owner", "claimant", "other", "processor", "session", "otherSession", "invitation",
    "key", "case", "intakeAttempt", "preparationAttempt", "object", "issueAttempt", "invalidAttempt",
    "crossAttempt", "quarantineAttempt", "scanFailureAttempt", "scanCleanAttempt", "planAttempt", "confirmAttempt"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  const conditions = { probate_required: false, relationship_evidence_required: false,
    name_variation_present: false, translation_required: false, attestation_required: false,
    dispute_known: false };
  const common = ["claimant_photo_identity", "identity_verification_result", "owner_match_reference",
    "official_death_record", "authority_basis", "processing_declaration", "conflict_declaration"];
  const checklist = common.map((item_key) => ({ item_key, source: "common", availability: "pending" }));
  const prepared = [{ item_key: "claimant_photo_identity", placeholder_ref: "synthetic_evidence_001",
    media_type: "application/pdf", size_bytes: 1024, prepared_at: "2026-08-12T10:00:00.000Z" }];
  const objectPath = `v1/${id.case}/${id.object}`;
  const capabilityDigest = "c".repeat(64);
  const contentDigest = "d".repeat(64);
  const sql = `
begin;
${migrations}
insert into auth.users (id) values ('${id.owner}'), ('${id.claimant}'), ('${id.other}'), ('${id.processor}');
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
declare v_result jsonb; v_count integer; v_status text; v_version integer; v_availability text;
  v_capability_expires timestamptz := date_trunc('milliseconds', now() + interval '5 minutes');
begin
  perform public.claimant_initialize_claim_intake('${id.claimant}', '${id.session}', '${id.case}', 1,
    'synthetic_jurisdiction_alpha', $json$${JSON.stringify(conditions)}$json$::jsonb,
    'synthetic_policy_death_alpha', 1, $json$${JSON.stringify(checklist)}$json$::jsonb, '${id.intakeAttempt}');
  perform public.claimant_record_evidence_preparation('${id.claimant}', '${id.session}', '${id.case}',
    2, 1, 'synthetic_policy_death_alpha', 1, 'synthetic_bundle_quarantine',
    $json$${JSON.stringify(prepared)}$json$::jsonb, '[]'::jsonb, '${id.preparationAttempt}');

  if (select public from storage.buckets where id = 'claimant-evidence-quarantine-v1') then
    raise exception 'quarantine bucket was public';
  end if;
  if (select file_size_limit from storage.buckets where id = 'claimant-evidence-quarantine-v1') <> 26214400 then
    raise exception 'quarantine bucket size limit drifted';
  end if;
  begin
    perform public.claimant_issue_evidence_upload_capability('${id.other}', '${id.otherSession}', '${id.case}',
      2, 2, 2, 'claimant_photo_identity', 'synthetic_evidence_001', '${id.object}', '${objectPath}',
      '${capabilityDigest}', now() + interval '5 minutes', '${id.crossAttempt}');
    raise exception 'cross-claimant upload capability was issued';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claimant_issue_evidence_upload_capability('${id.claimant}', '${id.otherSession}', '${id.case}',
      2, 2, 2, 'claimant_photo_identity', 'synthetic_evidence_001', '${id.object}', '${objectPath}',
      '${capabilityDigest}', now() + interval '5 minutes', '${id.crossAttempt}');
    raise exception 'displaced session upload capability was issued';
  exception when invalid_authorization_specification then null;
  end;
  begin
    perform public.claimant_issue_evidence_upload_capability('${id.claimant}', '${id.session}', '${id.case}',
      2, 2, 2, 'claimant_photo_identity', 'synthetic_evidence_001', '${id.object}', 'wrong/path',
      '${capabilityDigest}', now() + interval '5 minutes', '${id.invalidAttempt}');
    raise exception 'unbound object path was accepted';
  exception when invalid_parameter_value then null;
  end;
  v_result := public.claimant_issue_evidence_upload_capability('${id.claimant}', '${id.session}', '${id.case}',
    2, 2, 2, 'claimant_photo_identity', 'synthetic_evidence_001', '${id.object}', '${objectPath}',
    '${capabilityDigest}', v_capability_expires, '${id.issueAttempt}');
  if v_result ->> 'object_path' <> '${objectPath}' or (v_result ->> 'replayed')::boolean then
    raise exception 'upload capability result was invalid';
  end if;
  if (select capability_digest from public.claimant_evidence_upload_capabilities where id = '${id.object}')
      <> '${capabilityDigest}' then raise exception 'capability digest was not stored'; end if;
  v_result := public.claimant_get_evidence_upload_reconciliation('${id.object}', '${capabilityDigest}');
  if v_result ->> 'authority' <> 'upload_pending' or v_result ->> 'object_status' is not null then
    raise exception 'pending upload reconciliation authority was invalid';
  end if;
  begin
    perform public.claimant_get_evidence_upload_reconciliation('${id.object}', '${"e".repeat(64)}');
    raise exception 'wrong capability digest reconciled upload';
  exception when insufficient_privilege then null;
  end;
  v_result := public.claimant_issue_evidence_upload_capability('${id.claimant}', '${id.session}', '${id.case}',
    2, 2, 2, 'claimant_photo_identity', 'synthetic_evidence_001', '${id.object}', '${objectPath}',
    '${capabilityDigest}', v_capability_expires, '${id.issueAttempt}');
  if not (v_result ->> 'replayed')::boolean then raise exception 'capability replay was not stable'; end if;
  begin
    perform public.claimant_issue_evidence_upload_capability('${id.claimant}', '${id.session}', '${id.case}',
      2, 2, 2, 'claimant_photo_identity', 'synthetic_evidence_001', '${id.object}', '${objectPath}',
      '${"e".repeat(64)}', v_capability_expires, '${id.issueAttempt}');
    raise exception 'changed-input capability replay was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    v_result := public.claimant_abandon_evidence_upload('${id.processor}', '${id.object}',
      '${capabilityDigest}', '${id.invalidAttempt}');
    if v_result ->> 'status' <> 'abandoned' then
      raise exception 'upload abandonment result was invalid' using errcode = '22023';
    end if;
    raise no_data_found;
  exception when no_data_found then null;
  end;
  if (select status from public.claimant_evidence_upload_capabilities where id = '${id.object}') <> 'issued' then
    raise exception 'abandonment rollback did not restore capability';
  end if;

  begin
    perform public.claimant_record_evidence_quarantine('${id.processor}', '${id.object}', '${capabilityDigest}',
      '${objectPath}', 'image/png', 1024, '${contentDigest}', null, 1024, 1,
      now() + interval '29 days', '${id.invalidAttempt}');
    raise exception 'media-type mismatch was quarantined';
  exception when insufficient_privilege then null;
  end;
  if (select status from public.claimant_evidence_upload_capabilities where id = '${id.object}') <> 'issued' then
    raise exception 'invalid quarantine consumed the capability';
  end if;

  v_result := public.claimant_record_evidence_quarantine('${id.processor}', '${id.object}', '${capabilityDigest}',
    '${objectPath}', 'application/pdf', 1024, '${contentDigest}', 2, 4096, 1,
    now() + interval '29 days', '${id.quarantineAttempt}');
  if v_result ->> 'status' <> 'quarantined' or (v_result ->> 'version')::integer <> 1 then
    raise exception 'quarantine result was invalid';
  end if;
  v_result := public.claimant_get_evidence_upload_reconciliation('${id.object}', '${capabilityDigest}');
  if v_result ->> 'authority' <> 'object_recorded' or v_result ->> 'object_status' <> 'quarantined'
    or (v_result ->> 'object_version')::integer <> 1 then
    raise exception 'recorded upload reconciliation authority was invalid';
  end if;
  begin
    perform public.claimant_record_evidence_quarantine('${id.processor}', '${id.object}', '${capabilityDigest}',
      '${objectPath}', 'application/pdf', 1024, '${contentDigest}', 2, 4096, 1,
      now() + interval '29 days', '${id.invalidAttempt}');
    raise exception 'consumed capability was reused';
  exception when insufficient_privilege then null;
  end;

  v_result := public.claimant_record_evidence_scan('${id.processor}', '${id.object}', 1,
    'timeout', '${id.scanFailureAttempt}');
  if v_result ->> 'status' <> 'scan_failed' then raise exception 'scanner timeout did not fail closed'; end if;
  select availability into v_availability from public.claimant_checklist_items
    where case_id = '${id.case}' and item_key = 'claimant_photo_identity';
  if v_availability <> 'pending' then raise exception 'scanner timeout made evidence available'; end if;
  v_result := public.claimant_record_evidence_scan('${id.processor}', '${id.object}', 2,
    'clean', '${id.scanCleanAttempt}');
  if v_result ->> 'status' <> 'clean' or (v_result ->> 'version')::integer <> 3 then
    raise exception 'clean scanner retry failed';
  end if;
  select availability into v_availability from public.claimant_checklist_items
    where case_id = '${id.case}' and item_key = 'claimant_photo_identity';
  if v_availability <> 'available' then raise exception 'clean evidence did not update checklist'; end if;

  begin
    perform public.claimant_plan_evidence_deletion('${id.processor}', '${id.object}', 3, '${id.planAttempt}');
    raise exception 'unexpired evidence deletion was planned';
  exception when insufficient_privilege then null;
  end;
  update public.claimant_evidence_objects set quarantined_at = now() - interval '31 days',
    delete_after = now() - interval '1 day', legal_hold = true where id = '${id.object}';
  begin
    perform public.claimant_plan_evidence_deletion('${id.processor}', '${id.object}', 3, '${id.planAttempt}');
    raise exception 'legal-held evidence deletion was planned';
  exception when insufficient_privilege then null;
  end;
  update public.claimant_evidence_objects set legal_hold = false where id = '${id.object}';
  v_result := public.claimant_plan_evidence_deletion('${id.processor}', '${id.object}', 3, '${id.planAttempt}');
  if v_result ->> 'status' <> 'deletion_pending' or (v_result ->> 'version')::integer <> 4 then
    raise exception 'evidence deletion was not planned';
  end if;
  if (select deleted_at from public.claimant_evidence_objects where id = '${id.object}') is not null then
    raise exception 'planned deletion claimed bytes were deleted';
  end if;
  v_result := public.claimant_confirm_evidence_deleted('${id.processor}', '${id.object}', 4, '${id.confirmAttempt}');
  if v_result ->> 'status' <> 'deleted' or (v_result ->> 'version')::integer <> 5 then
    raise exception 'evidence deletion confirmation failed';
  end if;
  select availability into v_availability from public.claimant_checklist_items
    where case_id = '${id.case}' and item_key = 'claimant_photo_identity';
  if v_availability <> 'pending' then raise exception 'deleted evidence remained available'; end if;
  select count(*) into v_count from public.claimant_audit_events where case_id = '${id.case}'
    and event_type in ('upload_requested', 'upload_quarantined', 'upload_scanned',
      'evidence_deletion_planned', 'upload_deleted');
  if v_count <> 6 then raise exception 'quarantine lifecycle audit was incomplete'; end if;
end
$test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin
    insert into storage.objects (bucket_id, name) values
      ('claimant-evidence-quarantine-v1', 'v1/forbidden');
    raise exception 'authenticated role inserted quarantine object directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claimant_record_evidence_scan('${id.processor}', '${id.object}', 5, 'clean', gen_random_uuid());
    raise exception 'authenticated role executed quarantine function';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claimant_get_evidence_upload_reconciliation('${id.object}', '${capabilityDigest}');
    raise exception 'authenticated role executed upload reconciliation authority';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claimant_abandon_evidence_upload('${id.processor}', '${id.object}',
      '${capabilityDigest}', gen_random_uuid());
    raise exception 'authenticated role executed upload abandonment';
  exception when insufficient_privilege then null;
  end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_PRIVATE_QUARANTINE_DB_TEST_PASSED';
`;
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: sql });
  if (!output.includes("CLAIMANT_PRIVATE_QUARANTINE_DB_TEST_PASSED")) {
    throw new Error("Claimant private quarantine DB test marker was missing.");
  }
}

if (require.main === module) {
  runClaimantPrivateQuarantineDbTest();
  console.log("Claimant private quarantine DB test passed.");
}
module.exports = { runClaimantPrivateQuarantineDbTest };
