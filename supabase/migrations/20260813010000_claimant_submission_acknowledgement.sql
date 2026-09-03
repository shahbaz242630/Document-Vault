alter table public.claimant_idempotency_records drop constraint claimant_idempotency_records_operation_check;
alter table public.claimant_idempotency_records add constraint claimant_idempotency_records_operation_check check (
  operation in (
    'issue_registered_invitation', 'accept_registered_invitation',
    'activate_claimant_session', 'revoke_claimant_session',
    'activate_claimant_portal_session', 'revoke_claimant_portal_session',
    'revoke_registered_invitation', 'lifecycle_enroll', 'lifecycle_replace',
    'lifecycle_revoke', 'lifecycle_finalize',
    'register_claimant_app_attest_key', 'advance_claimant_app_attest_assertion',
    'issue_app_attest_registration_challenge', 'consume_app_attest_registration_challenge',
    'issue_native_enrollment_challenge', 'accept_native_enrollment',
    'initialize_claim_intake', 'record_evidence_preparation',
    'issue_evidence_upload_capability', 'record_evidence_quarantine',
    'record_evidence_scan', 'plan_evidence_deletion', 'confirm_evidence_deleted',
    'submit_claim_for_review'
  )
);

alter table public.claimant_audit_events drop constraint claimant_audit_events_event_type_check;
alter table public.claimant_audit_events add constraint claimant_audit_events_event_type_check check (event_type in (
  'registered_invitation_issued', 'registered_invitation_accepted',
  'registered_invitation_revoked', 'claimant_key_enrolled', 'claimant_key_replaced',
  'claimant_key_revoked', 'claim_draft_created', 'registered_recipient_finalized',
  'claim_intake_initialized', 'evidence_preparation_recorded',
  'upload_requested', 'upload_quarantined', 'upload_scanned', 'upload_rejected',
  'evidence_deletion_planned', 'upload_deleted', 'claim_submission_received'
));

alter table public.claimant_outbox drop constraint claimant_outbox_topic_check;
alter table public.claimant_outbox add constraint claimant_outbox_topic_check check (topic in (
  'registered_invitation_issued', 'registered_invitation_revoked',
  'registered_recipient_case_created', 'registered_recipient_binding_invalidated',
  'registered_recipient_finalized', 'claim_submission_received'
));

alter table public.claimant_cases add constraint claimant_cases_submission_binding_unique
unique (id, claimant_user_id);

create table public.claimant_submission_receipts (
  case_id uuid primary key,
  claimant_user_id uuid not null references public.claimant_identities(user_id) on delete restrict,
  protocol text not null default 'sanduqkin:claim:submission-acknowledgement:v1'
    check (protocol = 'sanduqkin:claim:submission-acknowledgement:v1'),
  synthetic_only boolean not null check (synthetic_only),
  submission_ref text not null unique check (submission_ref ~ '^synthetic_submission_[a-z0-9_]{1,100}$'),
  acknowledgement_ref text not null unique
    check (acknowledgement_ref ~ '^synthetic_acknowledgement_[0-9a-f]{32}$'),
  submission_digest text not null check (submission_digest ~ '^[0-9a-f]{64}$'),
  case_version integer not null check (case_version > 1),
  intake_version integer not null check (intake_version > 1),
  preparation_version integer not null check (preparation_version > 1),
  evidence_object_count integer not null check (evidence_object_count between 0 and 13),
  unavailable_item_count integer not null check (unavailable_item_count between 0 and 13),
  status text not null check (status = 'received_for_review'),
  review_started boolean not null check (not review_started),
  release_authorized boolean not null check (not release_authorized),
  claimed_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  check (claimed_created_at <= received_at),
  check (evidence_object_count + unavailable_item_count between 1 and 13),
  unique (case_id, claimant_user_id, case_version),
  foreign key (case_id, claimant_user_id)
    references public.claimant_cases (id, claimant_user_id) on delete restrict
);

revoke all on table public.claimant_submission_receipts from public;
revoke all on table public.claimant_submission_receipts from anon;
revoke all on table public.claimant_submission_receipts from authenticated;
grant select, insert on table public.claimant_submission_receipts to service_role;
alter table public.claimant_submission_receipts enable row level security;
alter table public.claimant_submission_receipts force row level security;
create policy "Claimant submission receipts are server-only."
on public.claimant_submission_receipts for all to anon, authenticated using (false) with check (false);

create function public.claimant_submit_claim_for_review(
  p_claimant_user_id uuid, p_portal_session_id uuid, p_case_id uuid,
  p_expected_case_version integer, p_expected_intake_version integer,
  p_expected_preparation_version integer, p_submission_ref text,
  p_policy_pack_id text, p_policy_pack_version integer, p_bundle_ref text,
  p_evidence_manifest jsonb, p_declarations jsonb, p_created_at timestamptz,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_intake public.claimant_intake_snapshots%rowtype;
  v_existing public.claimant_idempotency_records%rowtype;
  v_item jsonb;
  v_item_key text;
  v_placeholder_ref text;
  v_seen_items text[] := array[]::text[];
  v_seen_refs text[] := array[]::text[];
  v_key_count integer;
  v_checklist_count integer;
  v_manifest_count integer;
  v_available_count integer;
  v_unavailable_count integer;
  v_preparation_version integer;
  v_request_digest text;
  v_acknowledgement_ref text;
  v_result jsonb;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  perform pg_advisory_xact_lock(hashtextextended('claimant:submission:' || p_case_id::text, 0));

  if p_expected_case_version < 1 or p_expected_intake_version < 2
    or p_expected_preparation_version < 2 or p_policy_pack_version < 1
    or p_submission_ref !~ '^synthetic_submission_[a-z0-9_]{1,100}$'
    or p_policy_pack_id !~ '^synthetic_policy_[a-z0-9_]{1,100}$'
    or p_bundle_ref !~ '^synthetic_bundle_[a-z0-9_]{1,100}$'
    or p_created_at > now() or jsonb_typeof(p_evidence_manifest) <> 'array'
    or jsonb_typeof(p_declarations) <> 'array'
    or jsonb_array_length(p_evidence_manifest) > 13
    or jsonb_array_length(p_declarations) <> 4
    or (select count(distinct value) from jsonb_array_elements_text(p_declarations)) <> 4
    or not p_declarations @> '["information_is_accurate", "evidence_is_lawfully_held",
      "known_conflicts_are_disclosed", "review_is_not_release"]'::jsonb then
    raise exception 'Claim submission input is invalid.' using errcode = '22023';
  end if;

  v_manifest_count := jsonb_array_length(p_evidence_manifest);
  for v_item in select value from jsonb_array_elements(p_evidence_manifest) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Claim submission manifest is invalid.' using errcode = '22023';
    end if;
    select count(*) into v_key_count from jsonb_object_keys(v_item);
    if v_key_count <> 2 or not v_item ?& array['item_key', 'placeholder_ref'] then
      raise exception 'Claim submission manifest is invalid.' using errcode = '22023';
    end if;
    v_item_key := v_item ->> 'item_key';
    v_placeholder_ref := v_item ->> 'placeholder_ref';
    if v_item_key = any(v_seen_items) or v_placeholder_ref = any(v_seen_refs)
      or v_placeholder_ref !~ '^synthetic_evidence_[a-z0-9_]{1,100}$' then
      raise exception 'Claim submission manifest is invalid.' using errcode = '22023';
    end if;
    v_seen_items := array_append(v_seen_items, v_item_key);
    v_seen_refs := array_append(v_seen_refs, v_placeholder_ref);
  end loop;

  v_request_digest := encode(extensions.digest(concat_ws('|', p_claimant_user_id::text,
    p_case_id::text, p_expected_case_version::text, p_expected_intake_version::text,
    p_expected_preparation_version::text, p_submission_ref, p_policy_pack_id,
    p_policy_pack_version::text, p_bundle_ref, p_evidence_manifest::text,
    p_declarations::text, p_created_at::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
  where operation = 'submit_claim_for_review' and actor_user_id = p_claimant_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was already used with different submission input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true, 'status', 'already_received');
  end if;

  select * into v_case from public.claimant_cases where id = p_case_id for update;
  if v_case.id is null or v_case.claimant_user_id <> p_claimant_user_id then
    raise exception 'Claim submission case is unavailable.' using errcode = '42501';
  end if;
  if v_case.state <> 'identity_pending' or v_case.version <> p_expected_case_version then
    raise exception 'Claim submission case changed.' using errcode = '40001';
  end if;
  if v_case.policy_pack_id <> p_policy_pack_id or v_case.policy_pack_version <> p_policy_pack_version
    or p_created_at < v_case.created_at then
    raise exception 'Claim submission binding is invalid.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.claimant_identities
      where user_id = p_claimant_user_id and status = 'active')
    or not exists (select 1 from public.claimant_case_device_keys
      where case_id = p_case_id and key_id = v_case.current_key_id
        and claimant_user_id = p_claimant_user_id and status = 'active') then
    raise exception 'Claim submission claimant binding is invalid.' using errcode = '42501';
  end if;

  select * into v_intake from public.claimant_intake_snapshots where case_id = p_case_id for update;
  if v_intake.case_id is null or v_intake.claimant_user_id <> p_claimant_user_id
    or v_intake.policy_pack_id <> p_policy_pack_id or v_intake.policy_pack_version <> p_policy_pack_version then
    raise exception 'Claim submission intake is unavailable.' using errcode = '42501';
  end if;
  if v_intake.version <> p_expected_intake_version
    or v_intake.status not in ('ready_for_review', 'manual_review') then
    raise exception 'Claim submission intake changed.' using errcode = '40001';
  end if;
  if exists (select 1 from public.claimant_checklist_items
      where case_id = p_case_id and availability = 'pending') then
    raise exception 'Claim submission evidence is incomplete.' using errcode = '40001';
  end if;

  select max(preparation_version) into v_preparation_version
  from public.claimant_evidence_preparation_items where case_id = p_case_id;
  if v_preparation_version is null or v_preparation_version <> p_expected_preparation_version then
    raise exception 'Claim submission preparation changed.' using errcode = '40001';
  end if;
  select count(*) into v_checklist_count from public.claimant_checklist_items where case_id = p_case_id;
  if (select count(*) from public.claimant_evidence_preparation_items
      where case_id = p_case_id and preparation_version = v_preparation_version
        and claimant_user_id = p_claimant_user_id and policy_pack_id = p_policy_pack_id
        and policy_pack_version = p_policy_pack_version and bundle_ref = p_bundle_ref) <> v_checklist_count then
    raise exception 'Claim submission preparation is incomplete.' using errcode = '40001';
  end if;

  select count(*) into v_available_count from public.claimant_checklist_items
  where case_id = p_case_id and availability = 'available';
  select count(*) into v_unavailable_count from public.claimant_checklist_items
  where case_id = p_case_id and availability = 'not_available';
  if v_available_count + v_unavailable_count <> v_checklist_count
    or v_manifest_count <> v_available_count
    or (v_intake.status = 'ready_for_review' and v_unavailable_count <> 0)
    or (v_intake.status = 'manual_review' and v_unavailable_count = 0) then
    raise exception 'Claim submission evidence state is inconsistent.' using errcode = '40001';
  end if;

  for v_item in select value from jsonb_array_elements(p_evidence_manifest) loop
    v_item_key := v_item ->> 'item_key'; v_placeholder_ref := v_item ->> 'placeholder_ref';
    if (select count(*) from public.claimant_evidence_preparation_items prep
      join public.claimant_checklist_items checklist on checklist.case_id = prep.case_id
        and checklist.item_key = prep.item_key and checklist.availability = 'available'
      join public.claimant_evidence_upload_capabilities capability on capability.case_id = prep.case_id
        and capability.preparation_version = prep.preparation_version
        and capability.item_key = prep.item_key and capability.claimant_user_id = prep.claimant_user_id
        and capability.placeholder_ref = prep.placeholder_ref and capability.status = 'consumed'
      join public.claimant_evidence_objects object on object.capability_id = capability.id
        and object.case_id = capability.case_id and object.claimant_user_id = capability.claimant_user_id
        and object.item_key = capability.item_key and object.status = 'clean'
      where prep.case_id = p_case_id and prep.preparation_version = v_preparation_version
        and prep.item_key = v_item_key and prep.placeholder_ref = v_placeholder_ref
        and prep.disposition = 'prepared') <> 1 then
      raise exception 'Claim submission clean evidence authority is unavailable.' using errcode = '40001';
    end if;
  end loop;
  if (select count(*) from public.claimant_evidence_preparation_items prep
      join public.claimant_checklist_items checklist on checklist.case_id = prep.case_id
        and checklist.item_key = prep.item_key
      where prep.case_id = p_case_id and prep.preparation_version = v_preparation_version
        and ((checklist.availability = 'not_available' and prep.disposition <> 'not_available')
          or (checklist.availability = 'available' and prep.disposition <> 'prepared'))) <> 0 then
    raise exception 'Claim submission preparation disposition is inconsistent.' using errcode = '40001';
  end if;

  update public.claimant_cases set state = 'submitted', version = version + 1, updated_at = now()
  where id = p_case_id and state = 'identity_pending' and version = p_expected_case_version
  returning * into v_case;
  if v_case.id is null then raise exception 'Claim submission case changed.' using errcode = '40001'; end if;

  v_acknowledgement_ref := 'synthetic_acknowledgement_' || substring(encode(extensions.digest(
    p_case_id::text || '|' || p_submission_ref, 'sha256'), 'hex') from 1 for 32);
  insert into public.claimant_submission_receipts (case_id, claimant_user_id, submission_ref,
    acknowledgement_ref, submission_digest, case_version, intake_version, preparation_version,
    evidence_object_count, unavailable_item_count, status, review_started, release_authorized,
    claimed_created_at, synthetic_only)
  values (p_case_id, p_claimant_user_id, p_submission_ref, v_acknowledgement_ref,
    v_request_digest, v_case.version, v_intake.version, v_preparation_version,
    v_available_count, v_unavailable_count, 'received_for_review', false, false, p_created_at, true);
  insert into public.claimant_audit_events (event_type, actor_user_id, case_id, idempotency_key, metadata)
  values ('claim_submission_received', p_claimant_user_id, p_case_id, p_idempotency_key,
    jsonb_build_object('case_version', v_case.version, 'intake_version', v_intake.version,
      'evidence_object_count', v_available_count, 'unavailable_item_count', v_unavailable_count));
  insert into public.claimant_outbox (topic, aggregate_type, aggregate_id, dedupe_key, payload)
  values ('claim_submission_received', 'case', p_case_id,
    'claim_submission_received:' || p_idempotency_key::text,
    jsonb_build_object('event', 'claim_submission_received', 'case_version', v_case.version));

  v_result := jsonb_build_object('acknowledgement_ref', v_acknowledgement_ref,
    'case_id', p_case_id, 'case_version', v_case.version, 'intake_version', v_intake.version,
    'preparation_version', v_preparation_version, 'status', 'received_for_review',
    'state', v_case.state, 'review_started', false, 'release_authorized', false,
    'replayed', false);
  insert into public.claimant_idempotency_records
    (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('submit_claim_for_review', p_claimant_user_id, p_idempotency_key,
    v_request_digest, v_result - 'replayed');
  return v_result;
end
$function$;

revoke all on function public.claimant_submit_claim_for_review(uuid, uuid, uuid, integer, integer,
  integer, text, text, integer, text, jsonb, jsonb, timestamptz, uuid) from public;
revoke all on function public.claimant_submit_claim_for_review(uuid, uuid, uuid, integer, integer,
  integer, text, text, integer, text, jsonb, jsonb, timestamptz, uuid) from anon;
revoke all on function public.claimant_submit_claim_for_review(uuid, uuid, uuid, integer, integer,
  integer, text, text, integer, text, jsonb, jsonb, timestamptz, uuid) from authenticated;
grant execute on function public.claimant_submit_claim_for_review(uuid, uuid, uuid, integer, integer,
  integer, text, text, integer, text, jsonb, jsonb, timestamptz, uuid) to service_role;
