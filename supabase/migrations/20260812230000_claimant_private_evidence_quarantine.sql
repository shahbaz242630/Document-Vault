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
    'record_evidence_scan', 'plan_evidence_deletion', 'confirm_evidence_deleted'
  )
);

alter table public.claimant_audit_events drop constraint claimant_audit_events_event_type_check;
alter table public.claimant_audit_events add constraint claimant_audit_events_event_type_check check (event_type in (
  'registered_invitation_issued', 'registered_invitation_accepted',
  'registered_invitation_revoked', 'claimant_key_enrolled', 'claimant_key_replaced',
  'claimant_key_revoked', 'claim_draft_created', 'registered_recipient_finalized',
  'claim_intake_initialized', 'evidence_preparation_recorded',
  'upload_requested', 'upload_quarantined', 'upload_scanned', 'upload_rejected',
  'evidence_deletion_planned', 'upload_deleted'
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('claimant-evidence-quarantine-v1', 'claimant-evidence-quarantine-v1', false, 26214400,
  array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 26214400,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

create policy "Claimant quarantine objects deny anonymous access."
on storage.objects as restrictive for all to anon
using (bucket_id <> 'claimant-evidence-quarantine-v1')
with check (bucket_id <> 'claimant-evidence-quarantine-v1');
create policy "Claimant quarantine objects deny authenticated access."
on storage.objects as restrictive for all to authenticated
using (bucket_id <> 'claimant-evidence-quarantine-v1')
with check (bucket_id <> 'claimant-evidence-quarantine-v1');

alter table public.claimant_evidence_preparation_items
add constraint claimant_evidence_preparation_upload_binding_unique
unique (case_id, preparation_version, item_key, claimant_user_id, placeholder_ref, media_type, size_bytes);

create table public.claimant_evidence_upload_capabilities (
  id uuid primary key,
  case_id uuid not null,
  claimant_user_id uuid not null,
  preparation_version integer not null check (preparation_version > 1),
  item_key text not null,
  placeholder_ref text not null check (placeholder_ref ~ '^synthetic_evidence_[a-z0-9_]{1,100}$'),
  object_path text not null unique,
  capability_digest text not null unique check (capability_digest ~ '^[0-9a-f]{64}$'),
  expected_media_type text not null check (expected_media_type in ('application/pdf', 'image/jpeg', 'image/png')),
  expected_size_bytes integer not null check (expected_size_bytes between 1 and 26214400),
  status text not null default 'issued' check (status in ('issued', 'consumed', 'revoked')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  check (expires_at > issued_at and expires_at <= issued_at + interval '5 minutes'),
  check ((status = 'issued' and consumed_at is null and revoked_at is null)
    or (status = 'consumed' and consumed_at is not null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null and consumed_at is null)),
  check (object_path = 'v1/' || case_id::text || '/' || id::text),
  unique (case_id, preparation_version, item_key),
  unique (id, case_id, claimant_user_id, item_key, object_path),
  foreign key (case_id, preparation_version, item_key, claimant_user_id,
    placeholder_ref, expected_media_type, expected_size_bytes)
    references public.claimant_evidence_preparation_items
      (case_id, preparation_version, item_key, claimant_user_id,
        placeholder_ref, media_type, size_bytes) on delete restrict
);

create table public.claimant_evidence_objects (
  id uuid primary key,
  capability_id uuid not null unique references public.claimant_evidence_upload_capabilities(id) on delete restrict,
  case_id uuid not null,
  claimant_user_id uuid not null,
  item_key text not null,
  object_path text not null unique,
  content_digest text not null check (content_digest ~ '^[0-9a-f]{64}$'),
  detected_media_type text not null check (detected_media_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes between 1 and 26214400),
  page_count integer check (page_count is null or page_count between 1 and 50),
  expanded_size_bytes integer not null check (expanded_size_bytes between 1 and 104857600),
  archive_entry_count integer not null default 1 check (archive_entry_count = 1),
  status text not null default 'quarantined' check (
    status in ('quarantined', 'clean', 'rejected', 'scan_failed', 'deletion_pending', 'deleted')
  ),
  scan_result text check (scan_result is null or scan_result in ('clean', 'malicious', 'error', 'timeout')),
  retention_policy_id text not null check (retention_policy_id = 'synthetic_retention_30d_v1'),
  delete_after timestamptz not null,
  legal_hold boolean not null default false,
  quarantined_at timestamptz not null default now(),
  scanned_at timestamptz,
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  check (delete_after > quarantined_at and delete_after <= quarantined_at + interval '30 days'),
  check (object_path = 'v1/' || case_id::text || '/' || id::text),
  check ((status = 'quarantined' and scan_result is null and scanned_at is null and deleted_at is null)
    or (status = 'clean' and scan_result = 'clean' and scanned_at is not null and deleted_at is null)
    or (status = 'rejected' and scan_result = 'malicious' and scanned_at is not null and deleted_at is null)
    or (status = 'scan_failed' and scan_result in ('error', 'timeout') and scanned_at is not null and deleted_at is null)
    or (status = 'deletion_pending' and deleted_at is null)
    or (status = 'deleted' and deleted_at is not null)),
  foreign key (capability_id, case_id, claimant_user_id, item_key, object_path)
    references public.claimant_evidence_upload_capabilities
      (id, case_id, claimant_user_id, item_key, object_path) on delete restrict
);

create index claimant_upload_capability_case_idx
on public.claimant_evidence_upload_capabilities (claimant_user_id, case_id, expires_at desc);
create index claimant_evidence_object_case_idx
on public.claimant_evidence_objects (claimant_user_id, case_id, status, quarantined_at desc);

revoke all on table public.claimant_evidence_upload_capabilities from public;
revoke all on table public.claimant_evidence_upload_capabilities from anon;
revoke all on table public.claimant_evidence_upload_capabilities from authenticated;
revoke all on table public.claimant_evidence_objects from public;
revoke all on table public.claimant_evidence_objects from anon;
revoke all on table public.claimant_evidence_objects from authenticated;
grant select, insert, update on table public.claimant_evidence_upload_capabilities to service_role;
grant select, insert, update on table public.claimant_evidence_objects to service_role;
alter table public.claimant_evidence_upload_capabilities enable row level security;
alter table public.claimant_evidence_upload_capabilities force row level security;
alter table public.claimant_evidence_objects enable row level security;
alter table public.claimant_evidence_objects force row level security;
create policy "Claimant upload capabilities are server-only."
on public.claimant_evidence_upload_capabilities for all to anon, authenticated using (false) with check (false);
create policy "Claimant evidence objects are server-only."
on public.claimant_evidence_objects for all to anon, authenticated using (false) with check (false);

create function public.claimant_issue_evidence_upload_capability(
  p_claimant_user_id uuid, p_portal_session_id uuid, p_case_id uuid,
  p_expected_case_version integer, p_expected_intake_version integer,
  p_preparation_version integer, p_item_key text, p_placeholder_ref text,
  p_object_id uuid, p_object_path text, p_capability_digest text,
  p_expires_at timestamptz, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_intake public.claimant_intake_snapshots%rowtype;
  v_preparation public.claimant_evidence_preparation_items%rowtype;
  v_existing public.claimant_idempotency_records%rowtype;
  v_request_digest text;
  v_result jsonb;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  perform pg_advisory_xact_lock(hashtextextended('claimant:upload-capability:' || p_case_id::text, 0));
  if p_expected_case_version < 1 or p_expected_intake_version < 2
    or p_preparation_version <> p_expected_intake_version
    or p_object_path <> 'v1/' || p_case_id::text || '/' || p_object_id::text
    or p_capability_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Evidence upload capability input is invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_claimant_user_id::text,
    p_case_id::text, p_expected_case_version::text, p_expected_intake_version::text,
    p_preparation_version::text, p_item_key, p_placeholder_ref, p_object_id::text,
    p_object_path, p_capability_digest), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
  where operation = 'issue_evidence_upload_capability' and actor_user_id = p_claimant_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was already used with different upload input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '5 minutes' then
    raise exception 'Evidence upload capability input is invalid.' using errcode = '22023';
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  if v_case.id is null or v_case.claimant_user_id <> p_claimant_user_id then
    raise exception 'Evidence upload case is unavailable.' using errcode = '42501';
  end if;
  if v_case.state <> 'identity_pending' or v_case.version <> p_expected_case_version then
    raise exception 'Evidence upload case changed.' using errcode = '40001';
  end if;
  select * into v_intake from public.claimant_intake_snapshots where case_id = p_case_id for update;
  if v_intake.case_id is null or v_intake.claimant_user_id <> p_claimant_user_id
    or v_intake.version <> p_expected_intake_version
    or v_intake.status not in ('documents_needed', 'manual_review') then
    raise exception 'Evidence upload intake changed.' using errcode = '40001';
  end if;
  if not exists (select 1 from public.claimant_identities
      where user_id = p_claimant_user_id and status = 'active')
    or not exists (select 1 from public.claimant_case_device_keys
      where case_id = p_case_id and key_id = v_case.current_key_id
        and claimant_user_id = p_claimant_user_id and status = 'active') then
    raise exception 'Evidence upload claimant binding is invalid.' using errcode = '42501';
  end if;
  select * into v_preparation from public.claimant_evidence_preparation_items
  where case_id = p_case_id and preparation_version = p_preparation_version
    and item_key = p_item_key;
  if v_preparation.case_id is null or v_preparation.claimant_user_id <> p_claimant_user_id
    or v_preparation.disposition <> 'prepared'
    or v_preparation.placeholder_ref <> p_placeholder_ref then
    raise exception 'Prepared evidence binding is invalid.' using errcode = '42501';
  end if;
  insert into public.claimant_evidence_upload_capabilities (id, case_id, claimant_user_id,
    preparation_version, item_key, placeholder_ref, object_path, capability_digest,
    expected_media_type, expected_size_bytes, expires_at)
  values (p_object_id, p_case_id, p_claimant_user_id, p_preparation_version, p_item_key,
    p_placeholder_ref, p_object_path, p_capability_digest, v_preparation.media_type,
    v_preparation.size_bytes, p_expires_at);
  insert into public.claimant_audit_events (event_type, actor_user_id, case_id, idempotency_key, metadata)
  values ('upload_requested', p_claimant_user_id, p_case_id, p_idempotency_key,
    jsonb_build_object('object_id', p_object_id, 'item_key', p_item_key,
      'preparation_version', p_preparation_version));
  v_result := jsonb_build_object('case_id', p_case_id, 'object_id', p_object_id,
    'object_path', p_object_path, 'expires_at', p_expires_at, 'replayed', false);
  insert into public.claimant_idempotency_records
    (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('issue_evidence_upload_capability', p_claimant_user_id, p_idempotency_key,
    v_request_digest, v_result - 'replayed');
  return v_result;
end
$function$;

create function public.claimant_record_evidence_quarantine(
  p_processor_user_id uuid, p_object_id uuid, p_capability_digest text,
  p_object_path text, p_detected_media_type text, p_size_bytes integer,
  p_content_digest text, p_page_count integer, p_expanded_size_bytes integer,
  p_archive_entry_count integer, p_delete_after timestamptz, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_cap public.claimant_evidence_upload_capabilities%rowtype;
  v_existing public.claimant_idempotency_records%rowtype;
  v_request_digest text;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:evidence-object:' || p_object_id::text, 0));
  if p_capability_digest !~ '^[0-9a-f]{64}$' or p_content_digest !~ '^[0-9a-f]{64}$'
    or p_detected_media_type not in ('application/pdf', 'image/jpeg', 'image/png')
    or p_size_bytes not between 1 and 26214400
    or (p_detected_media_type = 'application/pdf'
      and (p_page_count is null or p_page_count not between 1 and 50))
    or (p_detected_media_type <> 'application/pdf' and p_page_count is not null)
    or p_expanded_size_bytes not between 1 and 104857600
    or p_archive_entry_count <> 1 or p_delete_after <= now()
    or p_delete_after > now() + interval '30 days' then
    raise exception 'Quarantine inspection is invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_object_id::text,
    p_capability_digest, p_object_path, p_detected_media_type, p_size_bytes::text,
    p_content_digest, coalesce(p_page_count::text, ''), p_expanded_size_bytes::text,
    p_archive_entry_count::text, p_delete_after::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
  where operation = 'record_evidence_quarantine' and actor_user_id = p_processor_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was already used with different quarantine input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_cap from public.claimant_evidence_upload_capabilities
  where id = p_object_id for update;
  if v_cap.id is null or v_cap.status <> 'issued' or v_cap.expires_at <= now()
    or v_cap.capability_digest <> p_capability_digest or v_cap.object_path <> p_object_path
    or v_cap.expected_media_type <> p_detected_media_type
    or v_cap.expected_size_bytes <> p_size_bytes then
    raise exception 'Upload capability is unavailable.' using errcode = '42501';
  end if;
  update public.claimant_evidence_upload_capabilities
  set status = 'consumed', consumed_at = now() where id = p_object_id;
  insert into public.claimant_evidence_objects (id, capability_id, case_id, claimant_user_id,
    item_key, object_path, content_digest, detected_media_type, size_bytes, page_count,
    expanded_size_bytes, archive_entry_count, retention_policy_id, delete_after)
  values (p_object_id, p_object_id, v_cap.case_id, v_cap.claimant_user_id, v_cap.item_key,
    p_object_path, p_content_digest, p_detected_media_type, p_size_bytes, p_page_count,
    p_expanded_size_bytes, p_archive_entry_count, 'synthetic_retention_30d_v1', p_delete_after);
  insert into public.claimant_audit_events (event_type, actor_user_id, case_id, idempotency_key, metadata)
  values ('upload_quarantined', p_processor_user_id, v_cap.case_id, p_idempotency_key,
    jsonb_build_object('object_id', p_object_id, 'item_key', v_cap.item_key));
  v_result := jsonb_build_object('case_id', v_cap.case_id, 'object_id', p_object_id,
    'status', 'quarantined', 'version', 1, 'replayed', false);
  insert into public.claimant_idempotency_records
    (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('record_evidence_quarantine', p_processor_user_id, p_idempotency_key,
    v_request_digest, v_result - 'replayed');
  return v_result;
end
$function$;

create function public.claimant_record_evidence_scan(
  p_processor_user_id uuid, p_object_id uuid, p_expected_version integer,
  p_scan_result text, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_object public.claimant_evidence_objects%rowtype;
  v_existing public.claimant_idempotency_records%rowtype;
  v_request_digest text;
  v_status text;
  v_result jsonb;
begin
  if p_expected_version < 1 or p_scan_result not in ('clean', 'malicious', 'error', 'timeout') then
    raise exception 'Evidence scan input is invalid.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('claimant:evidence-object:' || p_object_id::text, 0));
  v_request_digest := encode(extensions.digest(concat_ws('|', p_object_id::text,
    p_expected_version::text, p_scan_result), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
  where operation = 'record_evidence_scan' and actor_user_id = p_processor_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was already used with different scan input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_object from public.claimant_evidence_objects where id = p_object_id for update;
  if v_object.id is null then raise exception 'Evidence object is unavailable.' using errcode = '42501'; end if;
  if v_object.status not in ('quarantined', 'scan_failed') or v_object.version <> p_expected_version then
    raise exception 'Evidence object changed.' using errcode = '40001';
  end if;
  v_status := case when p_scan_result = 'clean' then 'clean'
    when p_scan_result = 'malicious' then 'rejected' else 'scan_failed' end;
  update public.claimant_evidence_objects set status = v_status, scan_result = p_scan_result,
    scanned_at = now(), version = version + 1 where id = p_object_id returning * into v_object;
  if v_status = 'clean' then
    update public.claimant_checklist_items set availability = 'available', updated_at = now()
    where case_id = v_object.case_id and item_key = v_object.item_key;
    update public.claimant_intake_snapshots set status = case
      when exists (select 1 from public.claimant_checklist_items
        where case_id = v_object.case_id and availability = 'not_available') then 'manual_review'
      when not exists (select 1 from public.claimant_checklist_items
        where case_id = v_object.case_id and availability <> 'available') then 'ready_for_review'
      else 'documents_needed' end,
      version = version + 1, updated_at = now() where case_id = v_object.case_id;
  end if;
  insert into public.claimant_audit_events (event_type, actor_user_id, case_id, idempotency_key, metadata)
  values (case when v_status = 'rejected' then 'upload_rejected' else 'upload_scanned' end,
    p_processor_user_id, v_object.case_id, p_idempotency_key,
    jsonb_build_object('object_id', p_object_id, 'result_class', p_scan_result));
  v_result := jsonb_build_object('case_id', v_object.case_id, 'object_id', p_object_id,
    'status', v_status, 'version', v_object.version, 'replayed', false);
  insert into public.claimant_idempotency_records
    (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('record_evidence_scan', p_processor_user_id, p_idempotency_key,
    v_request_digest, v_result - 'replayed');
  return v_result;
end
$function$;

create function public.claimant_plan_evidence_deletion(
  p_processor_user_id uuid, p_object_id uuid, p_expected_version integer,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_object public.claimant_evidence_objects%rowtype;
  v_existing public.claimant_idempotency_records%rowtype;
  v_request_digest text;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:evidence-object:' || p_object_id::text, 0));
  v_request_digest := encode(extensions.digest(concat_ws('|', p_object_id::text,
    p_expected_version::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
  where operation = 'plan_evidence_deletion' and actor_user_id = p_processor_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was already used with different deletion input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_object from public.claimant_evidence_objects where id = p_object_id for update;
  if v_object.id is null then raise exception 'Evidence object is unavailable.' using errcode = '42501'; end if;
  if v_object.version <> p_expected_version then
    raise exception 'Evidence object changed.' using errcode = '40001';
  end if;
  if v_object.legal_hold or v_object.delete_after > now()
    or v_object.status in ('deletion_pending', 'deleted') then
    raise exception 'Evidence object deletion is blocked.' using errcode = '42501';
  end if;
  update public.claimant_evidence_objects set status = 'deletion_pending',
    version = version + 1 where id = p_object_id returning * into v_object;
  insert into public.claimant_audit_events (event_type, actor_user_id, case_id, idempotency_key, metadata)
  values ('evidence_deletion_planned', p_processor_user_id, v_object.case_id, p_idempotency_key,
    jsonb_build_object('object_id', p_object_id));
  v_result := jsonb_build_object('case_id', v_object.case_id, 'object_id', p_object_id,
    'status', 'deletion_pending', 'version', v_object.version, 'replayed', false);
  insert into public.claimant_idempotency_records
    (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('plan_evidence_deletion', p_processor_user_id, p_idempotency_key,
    v_request_digest, v_result - 'replayed');
  return v_result;
end
$function$;

create function public.claimant_confirm_evidence_deleted(
  p_processor_user_id uuid, p_object_id uuid, p_expected_version integer,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_object public.claimant_evidence_objects%rowtype;
  v_existing public.claimant_idempotency_records%rowtype;
  v_request_digest text;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:evidence-object:' || p_object_id::text, 0));
  v_request_digest := encode(extensions.digest(concat_ws('|', p_object_id::text,
    p_expected_version::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
  where operation = 'confirm_evidence_deleted' and actor_user_id = p_processor_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was already used with different deletion confirmation.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_object from public.claimant_evidence_objects where id = p_object_id for update;
  if v_object.id is null then raise exception 'Evidence object is unavailable.' using errcode = '42501'; end if;
  if v_object.status <> 'deletion_pending' or v_object.version <> p_expected_version then
    raise exception 'Evidence deletion is not pending.' using errcode = '40001';
  end if;
  update public.claimant_evidence_objects set status = 'deleted', deleted_at = now(),
    version = version + 1 where id = p_object_id returning * into v_object;
  update public.claimant_checklist_items set availability = 'pending', updated_at = now()
    where case_id = v_object.case_id and item_key = v_object.item_key;
  update public.claimant_intake_snapshots set status = 'documents_needed',
    version = version + 1, updated_at = now() where case_id = v_object.case_id;
  insert into public.claimant_audit_events (event_type, actor_user_id, case_id, idempotency_key, metadata)
  values ('upload_deleted', p_processor_user_id, v_object.case_id, p_idempotency_key,
    jsonb_build_object('object_id', p_object_id));
  v_result := jsonb_build_object('case_id', v_object.case_id, 'object_id', p_object_id,
    'status', 'deleted', 'version', v_object.version, 'replayed', false);
  insert into public.claimant_idempotency_records
    (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('confirm_evidence_deleted', p_processor_user_id, p_idempotency_key,
    v_request_digest, v_result - 'replayed');
  return v_result;
end
$function$;

revoke all on function public.claimant_issue_evidence_upload_capability(uuid, uuid, uuid, integer,
  integer, integer, text, text, uuid, text, text, timestamptz, uuid) from public;
revoke all on function public.claimant_issue_evidence_upload_capability(uuid, uuid, uuid, integer,
  integer, integer, text, text, uuid, text, text, timestamptz, uuid) from anon;
revoke all on function public.claimant_issue_evidence_upload_capability(uuid, uuid, uuid, integer,
  integer, integer, text, text, uuid, text, text, timestamptz, uuid) from authenticated;
revoke all on function public.claimant_record_evidence_quarantine(uuid, uuid, text, text, text,
  integer, text, integer, integer, integer, timestamptz, uuid) from public;
revoke all on function public.claimant_record_evidence_quarantine(uuid, uuid, text, text, text,
  integer, text, integer, integer, integer, timestamptz, uuid) from anon;
revoke all on function public.claimant_record_evidence_quarantine(uuid, uuid, text, text, text,
  integer, text, integer, integer, integer, timestamptz, uuid) from authenticated;
revoke all on function public.claimant_record_evidence_scan(uuid, uuid, integer, text, uuid)
  from public;
revoke all on function public.claimant_record_evidence_scan(uuid, uuid, integer, text, uuid)
  from anon;
revoke all on function public.claimant_record_evidence_scan(uuid, uuid, integer, text, uuid)
  from authenticated;
revoke all on function public.claimant_plan_evidence_deletion(uuid, uuid, integer, uuid)
  from public;
revoke all on function public.claimant_plan_evidence_deletion(uuid, uuid, integer, uuid)
  from anon;
revoke all on function public.claimant_plan_evidence_deletion(uuid, uuid, integer, uuid)
  from authenticated;
revoke all on function public.claimant_confirm_evidence_deleted(uuid, uuid, integer, uuid) from public;
revoke all on function public.claimant_confirm_evidence_deleted(uuid, uuid, integer, uuid) from anon;
revoke all on function public.claimant_confirm_evidence_deleted(uuid, uuid, integer, uuid) from authenticated;
grant execute on function public.claimant_issue_evidence_upload_capability(uuid, uuid, uuid, integer,
  integer, integer, text, text, uuid, text, text, timestamptz, uuid) to service_role;
grant execute on function public.claimant_record_evidence_quarantine(uuid, uuid, text, text, text,
  integer, text, integer, integer, integer, timestamptz, uuid) to service_role;
grant execute on function public.claimant_record_evidence_scan(uuid, uuid, integer, text, uuid)
  to service_role;
grant execute on function public.claimant_plan_evidence_deletion(uuid, uuid, integer, uuid)
  to service_role;
grant execute on function public.claimant_confirm_evidence_deleted(uuid, uuid, integer, uuid)
  to service_role;
