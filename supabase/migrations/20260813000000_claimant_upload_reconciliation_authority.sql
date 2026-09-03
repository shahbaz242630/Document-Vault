create function public.claimant_get_evidence_upload_reconciliation(
  p_object_id uuid,
  p_capability_digest text
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_cap public.claimant_evidence_upload_capabilities%rowtype;
  v_object public.claimant_evidence_objects%rowtype;
begin
  if p_capability_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Upload reconciliation input is invalid.' using errcode = '22023';
  end if;
  select * into v_cap from public.claimant_evidence_upload_capabilities where id = p_object_id;
  if v_cap.id is null or v_cap.capability_digest <> p_capability_digest then
    raise exception 'Upload reconciliation authority is unavailable.' using errcode = '42501';
  end if;
  select * into v_object from public.claimant_evidence_objects where id = p_object_id;
  if v_object.id is not null then
    return jsonb_build_object('case_id', v_cap.case_id, 'object_id', v_cap.id,
      'object_path', v_cap.object_path, 'authority', 'object_recorded',
      'capability_status', v_cap.status, 'object_status', v_object.status,
      'object_version', v_object.version, 'expected_media_type', v_cap.expected_media_type,
      'expected_size_bytes', v_cap.expected_size_bytes);
  end if;
  return jsonb_build_object('case_id', v_cap.case_id, 'object_id', v_cap.id,
    'object_path', v_cap.object_path,
    'authority', case when v_cap.status = 'issued' and v_cap.expires_at > now()
      then 'upload_pending' else 'upload_uncommitted' end,
    'capability_status', v_cap.status, 'object_status', null, 'object_version', null,
    'expected_media_type', v_cap.expected_media_type,
    'expected_size_bytes', v_cap.expected_size_bytes);
end
$function$;

revoke all on function public.claimant_get_evidence_upload_reconciliation(uuid, text) from public;
revoke all on function public.claimant_get_evidence_upload_reconciliation(uuid, text) from anon;
revoke all on function public.claimant_get_evidence_upload_reconciliation(uuid, text) from authenticated;
grant execute on function public.claimant_get_evidence_upload_reconciliation(uuid, text) to service_role;

create function public.claimant_abandon_evidence_upload(
  p_processor_user_id uuid,
  p_object_id uuid,
  p_capability_digest text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_cap public.claimant_evidence_upload_capabilities%rowtype;
begin
  if p_capability_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Upload abandonment input is invalid.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('claimant:evidence-object:' || p_object_id::text, 0));
  select * into v_cap from public.claimant_evidence_upload_capabilities
  where id = p_object_id for update;
  if v_cap.id is null or v_cap.capability_digest <> p_capability_digest then
    raise exception 'Upload abandonment authority is unavailable.' using errcode = '42501';
  end if;
  if exists (select 1 from public.claimant_evidence_objects where id = p_object_id) then
    raise exception 'Recorded evidence cannot be abandoned.' using errcode = '40001';
  end if;
  if v_cap.status = 'consumed' then
    raise exception 'Consumed evidence cannot be abandoned.' using errcode = '40001';
  end if;
  if v_cap.status = 'revoked' then
    return jsonb_build_object('case_id', v_cap.case_id, 'object_id', v_cap.id,
      'object_path', v_cap.object_path, 'status', 'abandoned', 'replayed', true);
  end if;
  update public.claimant_evidence_upload_capabilities set status = 'revoked', revoked_at = now()
  where id = p_object_id;
  insert into public.claimant_audit_events (event_type, actor_user_id, case_id, idempotency_key, metadata)
  values ('upload_rejected', p_processor_user_id, v_cap.case_id, p_idempotency_key,
    jsonb_build_object('object_id', p_object_id, 'reason_class', 'uncommitted_cleanup'));
  return jsonb_build_object('case_id', v_cap.case_id, 'object_id', v_cap.id,
    'object_path', v_cap.object_path, 'status', 'abandoned', 'replayed', false);
end
$function$;

revoke all on function public.claimant_abandon_evidence_upload(uuid, uuid, text, uuid) from public;
revoke all on function public.claimant_abandon_evidence_upload(uuid, uuid, text, uuid) from anon;
revoke all on function public.claimant_abandon_evidence_upload(uuid, uuid, text, uuid) from authenticated;
grant execute on function public.claimant_abandon_evidence_upload(uuid, uuid, text, uuid) to service_role;
