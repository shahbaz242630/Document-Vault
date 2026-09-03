const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const DEFAULT_CONTAINER = "supabase_db_supabase";

function runClaimantIntakeFoundationDbTest(options = {}) {
  const id = Object.fromEntries(["owner", "claimant", "other", "session", "otherSession", "invitation",
    "key", "case", "attempt", "invalidAttempt", "staleAttempt", "crossAttempt"]
    .map((name) => [name, randomUUID()]));
  const conditions = { probate_required: true, relationship_evidence_required: false,
    name_variation_present: false, translation_required: false, attestation_required: false,
    dispute_known: false };
  const common = ["claimant_photo_identity", "identity_verification_result", "owner_match_reference",
    "official_death_record", "authority_basis", "processing_declaration", "conflict_declaration"];
  const items = [...common.map((item_key) => ({ item_key, source: "common", availability: "pending" })),
    { item_key: "probate_authority", source: "conditional", availability: "pending" }];
  const incomplete = items.filter(({ item_key }) => item_key !== "conflict_declaration");
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
declare v_result jsonb; v_count integer; v_state text; v_version integer;
begin
  begin
    insert into public.claimant_intake_snapshots (case_id, claimant_user_id, synthetic_only,
      jurisdiction_key, trigger_type, routing_conditions, policy_pack_id, policy_pack_version)
    values ('${id.case}', '${id.claimant}', true, 'synthetic_jurisdiction_alpha', 'death',
      ($json$${JSON.stringify(conditions)}$json$::jsonb || '{"email":"prohibited"}'::jsonb),
      'synthetic_policy_death_alpha', 1);
    raise exception 'direct intake insert accepted an extra routing fact';
  exception when check_violation then null;
  end;
  begin
    insert into public.claimant_intake_snapshots (case_id, claimant_user_id, synthetic_only,
      jurisdiction_key, trigger_type, routing_conditions, policy_pack_id, policy_pack_version)
    values ('${id.case}', '${id.other}', true, 'synthetic_jurisdiction_alpha', 'death',
      $json$${JSON.stringify(conditions)}$json$::jsonb, 'synthetic_policy_death_alpha', 1);
    raise exception 'direct intake insert changed the claimant binding';
  exception when foreign_key_violation then null;
  end;
  begin
    perform public.claimant_initialize_claim_intake('${id.claimant}', '${id.session}', '${id.case}', 1,
      'synthetic_jurisdiction_alpha', $json$${JSON.stringify(conditions)}$json$::jsonb,
      'synthetic_policy_death_alpha', 1, $json$${JSON.stringify(incomplete)}$json$::jsonb, '${id.invalidAttempt}');
    raise exception 'incomplete common checklist was accepted';
  exception when invalid_parameter_value then null;
  end;
  select count(*) into v_count from public.claimant_intake_snapshots where case_id = '${id.case}';
  select state, version into v_state, v_version from public.claimant_cases where id = '${id.case}';
  if v_count <> 0 or v_state <> 'draft' or v_version <> 1 then raise exception 'invalid checklist partially committed'; end if;

  update public.claimant_case_device_keys set status = 'revoked', revoked_at = now() where case_id = '${id.case}';
  begin
    perform public.claimant_initialize_claim_intake('${id.claimant}', '${id.session}', '${id.case}', 1,
      'synthetic_jurisdiction_alpha', $json$${JSON.stringify(conditions)}$json$::jsonb,
      'synthetic_policy_death_alpha', 1, $json$${JSON.stringify(items)}$json$::jsonb, '${id.invalidAttempt}');
    raise exception 'revoked key initialized intake';
  exception when insufficient_privilege then null;
  end;
  update public.claimant_case_device_keys set status = 'active', revoked_at = null where case_id = '${id.case}';

  begin
    perform public.claimant_initialize_claim_intake('${id.other}', '${id.otherSession}', '${id.case}', 1,
      'synthetic_jurisdiction_alpha', $json$${JSON.stringify(conditions)}$json$::jsonb,
      'synthetic_policy_death_alpha', 1, $json$${JSON.stringify(items)}$json$::jsonb, '${id.crossAttempt}');
    raise exception 'cross-claimant initialized intake';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.claimant_initialize_claim_intake('${id.claimant}', '${id.otherSession}', '${id.case}', 1,
      'synthetic_jurisdiction_alpha', $json$${JSON.stringify(conditions)}$json$::jsonb,
      'synthetic_policy_death_alpha', 1, $json$${JSON.stringify(items)}$json$::jsonb, '${id.crossAttempt}');
    raise exception 'displaced portal session initialized intake';
  exception when invalid_authorization_specification then null;
  end;

  v_result := public.claimant_initialize_claim_intake('${id.claimant}', '${id.session}', '${id.case}', 1,
    'synthetic_jurisdiction_alpha', $json$${JSON.stringify(conditions)}$json$::jsonb,
    'synthetic_policy_death_alpha', 1, $json$${JSON.stringify(items)}$json$::jsonb, '${id.attempt}');
  if v_result ->> 'state' <> 'identity_pending' or (v_result ->> 'case_version')::integer <> 2
    or (v_result ->> 'checklist_item_count')::integer <> 8 or (v_result ->> 'replayed')::boolean then
    raise exception 'intake initialization result was invalid';
  end if;
  select count(*) into v_count from public.claimant_checklist_items where case_id = '${id.case}';
  if v_count <> 8 then raise exception 'checklist rows were incomplete'; end if;
  if (select count(*) from public.claimant_audit_events where case_id = '${id.case}'
      and event_type = 'claim_intake_initialized') <> 1 then raise exception 'intake audit was missing'; end if;

  v_result := public.claimant_initialize_claim_intake('${id.claimant}', '${id.session}', '${id.case}', 1,
    'synthetic_jurisdiction_alpha', $json$${JSON.stringify(conditions)}$json$::jsonb,
    'synthetic_policy_death_alpha', 1, $json$${JSON.stringify(items)}$json$::jsonb, '${id.attempt}');
  if not (v_result ->> 'replayed')::boolean then raise exception 'stable replay was not returned'; end if;

  begin
    perform public.claimant_initialize_claim_intake('${id.claimant}', '${id.session}', '${id.case}', 1,
      'synthetic_jurisdiction_changed', $json$${JSON.stringify(conditions)}$json$::jsonb,
      'synthetic_policy_death_alpha', 1, $json$${JSON.stringify(items)}$json$::jsonb, '${id.attempt}');
    raise exception 'changed-input replay was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.claimant_initialize_claim_intake('${id.claimant}', '${id.session}', '${id.case}', 1,
      'synthetic_jurisdiction_alpha', $json$${JSON.stringify(conditions)}$json$::jsonb,
      'synthetic_policy_death_alpha', 1, $json$${JSON.stringify(items)}$json$::jsonb, '${id.staleAttempt}');
    raise exception 'stale case version was accepted';
  exception when serialization_failure then null;
  end;
end
$test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin
    perform public.claimant_initialize_claim_intake('${id.claimant}', '${id.session}', '${id.case}', 2,
      'synthetic_jurisdiction_alpha', '{}'::jsonb, 'synthetic_policy_death_alpha', 1, '[]'::jsonb, gen_random_uuid());
    raise exception 'authenticated role executed intake function';
  exception when insufficient_privilege then null;
  end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_INTAKE_FOUNDATION_DB_TEST_PASSED';
`;
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: sql });
  if (!output.includes("CLAIMANT_INTAKE_FOUNDATION_DB_TEST_PASSED")) throw new Error("Claim intake DB test marker was missing.");
}

if (require.main === module) { runClaimantIntakeFoundationDbTest(); console.log("Claimant intake foundation DB test passed."); }
module.exports = { runClaimantIntakeFoundationDbTest };
