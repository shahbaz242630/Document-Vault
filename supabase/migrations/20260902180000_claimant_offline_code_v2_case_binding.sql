alter table public.claimant_idempotency_records
drop constraint claimant_idempotency_records_operation_check;
alter table public.claimant_idempotency_records
add constraint claimant_idempotency_records_operation_check check (operation in (
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
  'submit_claim_for_review', 'bind_offline_code_v2_case'
));

alter table public.claimant_audit_events
drop constraint claimant_audit_events_event_type_check;
alter table public.claimant_audit_events
add constraint claimant_audit_events_event_type_check check (event_type in (
  'registered_invitation_issued', 'registered_invitation_accepted',
  'registered_invitation_revoked', 'claimant_key_enrolled', 'claimant_key_replaced',
  'claimant_key_revoked', 'claim_draft_created', 'registered_recipient_finalized',
  'claim_intake_initialized', 'evidence_preparation_recorded',
  'upload_requested', 'upload_quarantined', 'upload_scanned', 'upload_rejected',
  'evidence_deletion_planned', 'upload_deleted', 'claim_submission_received',
  'offline_code_v2_case_bound'
));

alter table public.claimant_offline_code_v2_events
drop constraint claimant_offline_code_v2_events_event_type_check;
alter table public.claimant_offline_code_v2_events
add constraint claimant_offline_code_v2_events_event_type_check check (event_type in (
  'locator_registered', 'challenge_issued', 'proof_invalid', 'proof_verified',
  'locator_locked', 'locator_revoked', 'locator_expired', 'case_bound'
));

alter table public.claimant_cases
alter column invitation_id drop not null,
alter column invitation_status drop not null,
alter column current_key_id drop not null,
drop constraint claimant_cases_route_profile_check,
add column offline_code_v2_locator_record_id uuid null,
add column offline_code_v2_locator_version integer null,
add column offline_code_v2_proof_key_version integer null,
add column offline_code_v2_challenge_id uuid null,
add column offline_code_v2_record_binding_digest text null,
add column offline_code_v2_portal_session_id uuid null,
add column offline_code_v2_portal_session_version integer null,
add column offline_code_v2_bound_at timestamptz null,
add constraint claimant_cases_route_profile_check check (
  route_profile in ('registered_recipient_v1', 'offline_code_v2')
),
add constraint claimant_cases_offline_locator_fk foreign key (
  offline_code_v2_locator_record_id, offline_code_v2_locator_version
) references public.claimant_offline_code_v2_locators(id, locator_version) on delete restrict,
add constraint claimant_cases_offline_challenge_fk foreign key (offline_code_v2_challenge_id)
  references public.claimant_offline_code_v2_challenges(id) on delete restrict,
add constraint claimant_cases_offline_locator_unique unique (offline_code_v2_locator_record_id),
add constraint claimant_cases_offline_challenge_unique unique (offline_code_v2_challenge_id),
add constraint claimant_cases_route_binding_check check (
  (
    route_profile = 'registered_recipient_v1'
    and invitation_id is not null and invitation_status = 'accepted'
    and current_key_id is not null
    and offline_code_v2_locator_record_id is null
    and offline_code_v2_locator_version is null
    and offline_code_v2_proof_key_version is null
    and offline_code_v2_challenge_id is null
    and offline_code_v2_record_binding_digest is null
    and offline_code_v2_portal_session_id is null
    and offline_code_v2_portal_session_version is null
    and offline_code_v2_bound_at is null
  ) or (
    route_profile = 'offline_code_v2'
    and invitation_id is null and invitation_status is null and current_key_id is null
    and offline_code_v2_locator_record_id is not null
    and offline_code_v2_locator_version = 2
    and offline_code_v2_proof_key_version = 1
    and offline_code_v2_challenge_id is not null
    and offline_code_v2_record_binding_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    and offline_code_v2_portal_session_id is not null
    and offline_code_v2_portal_session_version > 0
    and offline_code_v2_bound_at is not null
    and owner_finalized_at is null and finalization_version = 0
  )
);

create or replace function public.bind_claimant_case_initial_key()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  if new.route_profile = 'registered_recipient_v1' then
    insert into public.claimant_case_device_keys(case_id, key_id, claimant_user_id)
    values (new.id, new.current_key_id, new.claimant_user_id);
  end if;
  return new;
end $function$;

create function public.claimant_bind_offline_code_v2_case(
  p_case_id uuid,
  p_claimant_user_id uuid,
  p_portal_session_id uuid,
  p_challenge_id uuid,
  p_expected_record_binding_digest text,
  p_policy_pack_id text,
  p_policy_pack_version integer,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_existing public.claimant_idempotency_records%rowtype;
  v_eligibility public.claimant_portal_eligibilities%rowtype;
  v_session public.claimant_portal_session_controls%rowtype;
  v_challenge public.claimant_offline_code_v2_challenges%rowtype;
  v_locator public.claimant_offline_code_v2_locators%rowtype;
  v_identity public.claimant_identities%rowtype;
  v_case public.claimant_cases%rowtype;
  v_digest text;
  v_result jsonb;
begin
  if p_expected_record_binding_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_policy_pack_id <> 'synthetic_policy_death_alpha'
    or p_policy_pack_version <> 1 then
    raise exception 'Offline-code V2 case binding is unavailable.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:offline-v2:case-binding:' || p_claimant_user_id::text, 0));
  v_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_claimant_user_id::text, p_portal_session_id::text, p_challenge_id::text,
    p_expected_record_binding_digest, p_policy_pack_id, p_policy_pack_version::text),
    'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
  where operation = 'bind_offline_code_v2_case'
    and actor_user_id = p_claimant_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Offline-code V2 case binding changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;

  select * into v_eligibility from public.claimant_portal_eligibilities
  where user_id = p_claimant_user_id for update;
  select * into v_session from public.claimant_portal_session_controls
  where user_id = p_claimant_user_id for update;
  if v_eligibility.user_id is null or v_eligibility.status <> 'eligible'
    or v_eligibility.source <> 'synthetic_fixture'
    or v_session.user_id is null or v_session.status <> 'active'
    or v_session.assurance_level <> 'aal2'
    or v_session.active_session_id <> p_portal_session_id
    or v_session.authenticated_at < now() - interval '10 minutes'
    or v_session.authenticated_at > now() + interval '1 minute' then
    raise exception 'Offline-code V2 case binding is unavailable.' using errcode = '28000';
  end if;

  select * into v_challenge from public.claimant_offline_code_v2_challenges
  where id = p_challenge_id for update;
  if v_challenge.id is null or v_challenge.status <> 'verified'
    or v_challenge.terminal_at is null
    or v_challenge.terminal_at < now() - interval '5 minutes'
    or v_challenge.terminal_at > now() + interval '1 minute'
    or v_challenge.record_binding_digest <> p_expected_record_binding_digest then
    raise exception 'Offline-code V2 case binding is unavailable.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:offline-v2:locator:' || v_challenge.locator_record_id::text, 0));
  select * into v_locator from public.claimant_offline_code_v2_locators
  where id = v_challenge.locator_record_id for update;
  if v_locator.id is null or v_locator.status <> 'active' or v_locator.expires_at <= now()
    or v_locator.locator_version <> 2 or v_locator.proof_key_version <> 1
    or v_locator.record_binding_digest <> p_expected_record_binding_digest
    or v_challenge.locator_version <> v_locator.locator_version
    or v_challenge.proof_key_version <> v_locator.proof_key_version
    or v_challenge.proof_public_key <> v_locator.proof_public_key
    or v_locator.owner_user_id = p_claimant_user_id then
    raise exception 'Offline-code V2 case binding is unavailable.' using errcode = '42501';
  end if;

  insert into public.claimant_identities(user_id, status)
  values (p_claimant_user_id, 'pending') on conflict (user_id) do nothing;
  select * into v_identity from public.claimant_identities
  where user_id = p_claimant_user_id for update;
  if v_identity.status not in ('pending', 'active') then
    raise exception 'Offline-code V2 case binding is unavailable.' using errcode = '42501';
  end if;

  begin
    insert into public.claimant_cases (
      id, claimant_user_id, owner_user_id, invitation_id, invitation_status,
      current_key_id, route_profile, state, policy_pack_id, policy_pack_version,
      offline_code_v2_locator_record_id, offline_code_v2_locator_version,
      offline_code_v2_proof_key_version, offline_code_v2_challenge_id,
      offline_code_v2_record_binding_digest, offline_code_v2_portal_session_id,
      offline_code_v2_portal_session_version, offline_code_v2_bound_at
    ) values (
      p_case_id, p_claimant_user_id, v_locator.owner_user_id, null, null,
      null, 'offline_code_v2', 'draft', p_policy_pack_id, p_policy_pack_version,
      v_locator.id, v_locator.locator_version, v_locator.proof_key_version,
      v_challenge.id, v_locator.record_binding_digest, p_portal_session_id,
      v_session.version, now()
    ) returning * into v_case;
  exception when unique_violation then
    raise exception 'Offline-code V2 case binding is unavailable.' using errcode = '40001';
  end;

  insert into public.claimant_audit_events(
    event_type, actor_user_id, case_id, idempotency_key, metadata
  ) values ('offline_code_v2_case_bound', p_claimant_user_id, v_case.id,
    p_idempotency_key, jsonb_build_object('route_profile', 'offline_code_v2',
      'case_version', v_case.version, 'locator_version', v_locator.locator_version,
      'proof_key_version', v_locator.proof_key_version,
      'portal_session_version', v_session.version, 'synthetic_only', true));
  insert into public.claimant_offline_code_v2_events(
    locator_record_id, challenge_id, event_type, idempotency_key, metadata
  ) values (v_locator.id, v_challenge.id, 'case_bound', p_idempotency_key,
    jsonb_build_object('case_version', v_case.version,
      'portal_session_version', v_session.version, 'synthetic_only', true));

  v_result := jsonb_build_object(
    'case_id', v_case.id, 'case_version', v_case.version, 'state', v_case.state,
    'route_profile', v_case.route_profile, 'authority', 'route_possession_only',
    'claimant_session_bound', true, 'case_created', true,
    'identity_verified', false, 'relationship_verified', false,
    'intake_started', false, 'review_started', false,
    'release_authorized', false, 'replayed', false
  );
  insert into public.claimant_idempotency_records(
    operation, actor_user_id, idempotency_key, request_digest, result
  ) values ('bind_offline_code_v2_case', p_claimant_user_id,
    p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end $function$;

revoke all on function public.claimant_bind_offline_code_v2_case(
  uuid, uuid, uuid, uuid, text, text, integer, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_bind_offline_code_v2_case(
  uuid, uuid, uuid, uuid, text, text, integer, uuid
) to service_role;
