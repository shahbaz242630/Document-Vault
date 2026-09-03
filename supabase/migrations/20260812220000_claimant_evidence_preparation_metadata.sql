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
    'initialize_claim_intake', 'record_evidence_preparation'
  )
);

alter table public.claimant_audit_events drop constraint claimant_audit_events_event_type_check;
alter table public.claimant_audit_events add constraint claimant_audit_events_event_type_check check (event_type in (
  'registered_invitation_issued', 'registered_invitation_accepted',
  'registered_invitation_revoked', 'claimant_key_enrolled', 'claimant_key_replaced',
  'claimant_key_revoked', 'claim_draft_created', 'registered_recipient_finalized',
  'claim_intake_initialized', 'evidence_preparation_recorded'
));

alter table public.claimant_intake_snapshots add constraint claimant_intake_exact_binding_unique
unique (case_id, claimant_user_id, policy_pack_id, policy_pack_version);

create table public.claimant_evidence_preparation_items (
  case_id uuid not null,
  preparation_version integer not null check (preparation_version > 1),
  claimant_user_id uuid not null,
  policy_pack_id text not null,
  policy_pack_version integer not null check (policy_pack_version > 0),
  bundle_ref text not null check (bundle_ref ~ '^synthetic_bundle_[a-z0-9_]{1,100}$'),
  item_key text not null,
  disposition text not null check (disposition in ('prepared', 'not_available')),
  placeholder_ref text,
  media_type text,
  size_bytes integer,
  claimed_prepared_at timestamptz,
  synthetic_only boolean not null check (synthetic_only),
  recorded_at timestamptz not null default now(),
  primary key (case_id, preparation_version, item_key),
  unique (case_id, preparation_version, placeholder_ref),
  foreign key (case_id, item_key)
    references public.claimant_checklist_items (case_id, item_key) on delete restrict,
  foreign key (case_id, claimant_user_id, policy_pack_id, policy_pack_version)
    references public.claimant_intake_snapshots
      (case_id, claimant_user_id, policy_pack_id, policy_pack_version) on delete restrict,
  check (
    (disposition = 'prepared'
      and placeholder_ref ~ '^synthetic_evidence_[a-z0-9_]{1,100}$'
      and media_type in ('application/pdf', 'image/jpeg', 'image/png')
      and size_bytes between 1 and 26214400
      and claimed_prepared_at is not null and claimed_prepared_at <= recorded_at)
    or
    (disposition = 'not_available' and placeholder_ref is null and media_type is null
      and size_bytes is null and claimed_prepared_at is null)
  )
);

create index claimant_evidence_preparation_claimant_idx
on public.claimant_evidence_preparation_items
  (claimant_user_id, case_id, preparation_version desc);

revoke all on table public.claimant_evidence_preparation_items from public;
revoke all on table public.claimant_evidence_preparation_items from anon;
revoke all on table public.claimant_evidence_preparation_items from authenticated;
grant select, insert on table public.claimant_evidence_preparation_items to service_role;

alter table public.claimant_evidence_preparation_items enable row level security;
alter table public.claimant_evidence_preparation_items force row level security;
create policy "Claimant evidence preparation items are server-only."
on public.claimant_evidence_preparation_items for all to anon, authenticated
using (false) with check (false);

create function public.claimant_record_evidence_preparation(
  p_claimant_user_id uuid,
  p_portal_session_id uuid,
  p_case_id uuid,
  p_expected_case_version integer,
  p_expected_intake_version integer,
  p_policy_pack_id text,
  p_policy_pack_version integer,
  p_bundle_ref text,
  p_prepared_items jsonb,
  p_unavailable_items jsonb,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_intake public.claimant_intake_snapshots%rowtype;
  v_existing public.claimant_idempotency_records%rowtype;
  v_item jsonb;
  v_item_key text;
  v_seen text[] := array[]::text[];
  v_key_count integer;
  v_prepared_count integer;
  v_unavailable_count integer;
  v_preparation_version integer;
  v_prepared_at timestamptz;
  v_request_digest text;
  v_result jsonb;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  perform pg_advisory_xact_lock(hashtextextended('claimant:evidence-preparation:' || p_case_id::text, 0));

  if p_expected_case_version < 1 or p_expected_intake_version < 1 or p_policy_pack_version < 1
    or p_policy_pack_id !~ '^synthetic_policy_[a-z0-9_]{1,100}$'
    or p_bundle_ref !~ '^synthetic_bundle_[a-z0-9_]{1,100}$'
    or jsonb_typeof(p_prepared_items) <> 'array'
    or jsonb_typeof(p_unavailable_items) <> 'array' then
    raise exception 'Evidence preparation input is invalid.' using errcode = '22023';
  end if;

  v_prepared_count := jsonb_array_length(p_prepared_items);
  v_unavailable_count := jsonb_array_length(p_unavailable_items);
  if v_prepared_count + v_unavailable_count < 1
    or v_prepared_count + v_unavailable_count > 13 then
    raise exception 'Evidence preparation item count is invalid.' using errcode = '22023';
  end if;

  v_request_digest := encode(extensions.digest(concat_ws('|', p_claimant_user_id::text,
    p_case_id::text, p_expected_case_version::text, p_expected_intake_version::text,
    p_policy_pack_id, p_policy_pack_version::text, p_bundle_ref,
    p_prepared_items::text, p_unavailable_items::text), 'sha256'), 'hex');

  select * into v_existing from public.claimant_idempotency_records
  where operation = 'record_evidence_preparation' and actor_user_id = p_claimant_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was already used with different evidence input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;

  select * into v_case from public.claimant_cases where id = p_case_id for update;
  if v_case.id is null or v_case.claimant_user_id <> p_claimant_user_id then
    raise exception 'Evidence preparation case is unavailable.' using errcode = '42501';
  end if;
  if v_case.state <> 'identity_pending' or v_case.version <> p_expected_case_version then
    raise exception 'Evidence preparation case changed.' using errcode = '40001';
  end if;
  if v_case.policy_pack_id <> p_policy_pack_id
    or v_case.policy_pack_version <> p_policy_pack_version then
    raise exception 'Evidence preparation policy binding is invalid.' using errcode = '42501';
  end if;

  select * into v_intake from public.claimant_intake_snapshots
  where case_id = p_case_id for update;
  if v_intake.case_id is null or v_intake.claimant_user_id <> p_claimant_user_id
    or v_intake.policy_pack_id <> p_policy_pack_id
    or v_intake.policy_pack_version <> p_policy_pack_version then
    raise exception 'Evidence preparation intake is unavailable.' using errcode = '42501';
  end if;
  if v_intake.version <> p_expected_intake_version
    or v_intake.status not in ('documents_needed', 'manual_review') then
    raise exception 'Evidence preparation intake changed.' using errcode = '40001';
  end if;
  if not exists (select 1 from public.claimant_identities
      where user_id = p_claimant_user_id and status = 'active')
    or not exists (select 1 from public.claimant_case_device_keys
      where case_id = p_case_id and key_id = v_case.current_key_id
        and claimant_user_id = p_claimant_user_id and status = 'active') then
    raise exception 'Evidence preparation claimant binding is invalid.' using errcode = '42501';
  end if;

  v_preparation_version := v_intake.version + 1;
  for v_item in select value from jsonb_array_elements(p_prepared_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Prepared evidence metadata is invalid.' using errcode = '22023';
    end if;
    select count(*) into v_key_count from jsonb_object_keys(v_item);
    if v_key_count <> 5 or not v_item ?& array[
      'item_key', 'placeholder_ref', 'media_type', 'size_bytes', 'prepared_at'
    ] then
      raise exception 'Prepared evidence metadata is invalid.' using errcode = '22023';
    end if;
    v_item_key := v_item ->> 'item_key';
    if v_item_key = any(v_seen)
      or not exists (select 1 from public.claimant_checklist_items
        where case_id = p_case_id and item_key = v_item_key)
      or v_item ->> 'placeholder_ref' !~ '^synthetic_evidence_[a-z0-9_]{1,100}$'
      or v_item ->> 'media_type' not in ('application/pdf', 'image/jpeg', 'image/png')
      or jsonb_typeof(v_item -> 'size_bytes') <> 'number'
      or (v_item ->> 'size_bytes')::numeric <> trunc((v_item ->> 'size_bytes')::numeric)
      or (v_item ->> 'size_bytes')::numeric not between 1 and 26214400
      or v_item ->> 'prepared_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' then
      raise exception 'Prepared evidence metadata is invalid.' using errcode = '22023';
    end if;
    v_prepared_at := (v_item ->> 'prepared_at')::timestamptz;
    if v_prepared_at > now() then
      raise exception 'Prepared evidence metadata is invalid.' using errcode = '22023';
    end if;
    v_seen := array_append(v_seen, v_item_key);
    insert into public.claimant_evidence_preparation_items (
      case_id, preparation_version, claimant_user_id, policy_pack_id, policy_pack_version,
      bundle_ref, item_key, disposition, placeholder_ref, media_type, size_bytes,
      claimed_prepared_at, synthetic_only)
    values (p_case_id, v_preparation_version, p_claimant_user_id, p_policy_pack_id,
      p_policy_pack_version, p_bundle_ref, v_item_key, 'prepared',
      v_item ->> 'placeholder_ref', v_item ->> 'media_type',
      (v_item ->> 'size_bytes')::integer, v_prepared_at, true);
  end loop;

  for v_item in select value from jsonb_array_elements(p_unavailable_items) loop
    if jsonb_typeof(v_item) <> 'string' then
      raise exception 'Unavailable evidence item is invalid.' using errcode = '22023';
    end if;
    v_item_key := v_item #>> '{}';
    if v_item_key = any(v_seen)
      or not exists (select 1 from public.claimant_checklist_items
        where case_id = p_case_id and item_key = v_item_key) then
      raise exception 'Unavailable evidence item is invalid.' using errcode = '22023';
    end if;
    v_seen := array_append(v_seen, v_item_key);
    insert into public.claimant_evidence_preparation_items (
      case_id, preparation_version, claimant_user_id, policy_pack_id, policy_pack_version,
      bundle_ref, item_key, disposition, synthetic_only)
    values (p_case_id, v_preparation_version, p_claimant_user_id, p_policy_pack_id,
      p_policy_pack_version, p_bundle_ref, v_item_key, 'not_available', true);
  end loop;

  update public.claimant_checklist_items set availability = 'pending', updated_at = now()
  where case_id = p_case_id;
  update public.claimant_checklist_items set availability = 'not_available', updated_at = now()
  where case_id = p_case_id and item_key = any(v_seen)
    and item_key in (select value #>> '{}' from jsonb_array_elements(p_unavailable_items));

  update public.claimant_intake_snapshots
  set status = case when v_unavailable_count > 0 then 'manual_review' else 'documents_needed' end,
    version = v_preparation_version, updated_at = now()
  where case_id = p_case_id and version = p_expected_intake_version
  returning * into v_intake;
  if v_intake.case_id is null then
    raise exception 'Evidence preparation intake changed.' using errcode = '40001';
  end if;

  insert into public.claimant_audit_events
    (event_type, actor_user_id, case_id, idempotency_key, metadata)
  values ('evidence_preparation_recorded', p_claimant_user_id, p_case_id, p_idempotency_key,
    jsonb_build_object('intake_version', v_intake.version,
      'prepared_item_count', v_prepared_count, 'unavailable_item_count', v_unavailable_count,
      'policy_pack_id', p_policy_pack_id, 'policy_pack_version', p_policy_pack_version));

  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'intake_version', v_intake.version, 'prepared_item_count', v_prepared_count,
    'unavailable_item_count', v_unavailable_count, 'status', v_intake.status,
    'replayed', false);
  insert into public.claimant_idempotency_records
    (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('record_evidence_preparation', p_claimant_user_id, p_idempotency_key,
    v_request_digest, v_result - 'replayed');
  return v_result;
end
$function$;

revoke all on function public.claimant_record_evidence_preparation(uuid, uuid, uuid, integer,
  integer, text, integer, text, jsonb, jsonb, uuid) from public;
revoke all on function public.claimant_record_evidence_preparation(uuid, uuid, uuid, integer,
  integer, text, integer, text, jsonb, jsonb, uuid) from anon;
revoke all on function public.claimant_record_evidence_preparation(uuid, uuid, uuid, integer,
  integer, text, integer, text, jsonb, jsonb, uuid) from authenticated;
grant execute on function public.claimant_record_evidence_preparation(uuid, uuid, uuid, integer,
  integer, text, integer, text, jsonb, jsonb, uuid) to service_role;
