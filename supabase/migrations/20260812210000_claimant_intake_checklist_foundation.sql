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
    'initialize_claim_intake'
  )
);

alter table public.claimant_audit_events drop constraint claimant_audit_events_event_type_check;
alter table public.claimant_audit_events add constraint claimant_audit_events_event_type_check check (event_type in (
  'registered_invitation_issued', 'registered_invitation_accepted',
  'registered_invitation_revoked', 'claimant_key_enrolled', 'claimant_key_replaced',
  'claimant_key_revoked', 'claim_draft_created', 'registered_recipient_finalized',
  'claim_intake_initialized'
));

alter table public.claimant_cases add constraint claimant_cases_intake_binding_unique
unique (id, claimant_user_id, policy_pack_id, policy_pack_version);

create table public.claimant_intake_snapshots (
  case_id uuid primary key,
  claimant_user_id uuid not null references public.claimant_identities(user_id) on delete restrict,
  protocol text not null default 'sanduqkin:claim:intake:v1' check (protocol = 'sanduqkin:claim:intake:v1'),
  synthetic_only boolean not null check (synthetic_only),
  jurisdiction_key text not null check (jurisdiction_key ~ '^synthetic_jurisdiction_[a-z0-9_]{1,80}$'),
  trigger_type text not null check (trigger_type = 'death'),
  routing_conditions jsonb not null check (
    jsonb_typeof(routing_conditions) = 'object'
    and routing_conditions ?& array['probate_required', 'relationship_evidence_required',
      'name_variation_present', 'translation_required', 'attestation_required', 'dispute_known']
    and routing_conditions - 'probate_required' - 'relationship_evidence_required'
      - 'name_variation_present' - 'translation_required' - 'attestation_required'
      - 'dispute_known' = '{}'::jsonb
    and jsonb_typeof(routing_conditions -> 'probate_required') = 'boolean'
    and jsonb_typeof(routing_conditions -> 'relationship_evidence_required') = 'boolean'
    and jsonb_typeof(routing_conditions -> 'name_variation_present') = 'boolean'
    and jsonb_typeof(routing_conditions -> 'translation_required') = 'boolean'
    and jsonb_typeof(routing_conditions -> 'attestation_required') = 'boolean'
    and jsonb_typeof(routing_conditions -> 'dispute_known') = 'boolean'
  ),
  policy_pack_id text not null check (policy_pack_id ~ '^synthetic_policy_[a-z0-9_]{1,100}$'),
  policy_pack_version integer not null check (policy_pack_version > 0),
  status text not null default 'documents_needed' check (
    status in ('documents_needed', 'ready_for_review', 'manual_review')
  ),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at),
  foreign key (case_id, claimant_user_id, policy_pack_id, policy_pack_version)
    references public.claimant_cases (id, claimant_user_id, policy_pack_id, policy_pack_version)
    on delete restrict
);

create table public.claimant_checklist_items (
  case_id uuid not null references public.claimant_intake_snapshots(case_id) on delete restrict,
  item_key text not null check (item_key in (
    'claimant_photo_identity', 'identity_verification_result', 'owner_match_reference',
    'official_death_record', 'authority_basis', 'processing_declaration', 'conflict_declaration',
    'probate_authority', 'relationship_evidence', 'name_variation_evidence',
    'certified_translation', 'attestation_evidence', 'dispute_documents'
  )),
  source text not null check (source in ('common', 'conditional')),
  availability text not null default 'pending' check (
    availability in ('pending', 'available', 'not_available')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at),
  primary key (case_id, item_key)
);

create index claimant_intake_claimant_status_idx
on public.claimant_intake_snapshots (claimant_user_id, status, updated_at desc);

revoke all on table public.claimant_intake_snapshots from public;
revoke all on table public.claimant_intake_snapshots from anon;
revoke all on table public.claimant_intake_snapshots from authenticated;
revoke all on table public.claimant_checklist_items from public;
revoke all on table public.claimant_checklist_items from anon;
revoke all on table public.claimant_checklist_items from authenticated;
grant select, insert, update on table public.claimant_intake_snapshots to service_role;
grant select, insert, update on table public.claimant_checklist_items to service_role;

alter table public.claimant_intake_snapshots enable row level security;
alter table public.claimant_intake_snapshots force row level security;
alter table public.claimant_checklist_items enable row level security;
alter table public.claimant_checklist_items force row level security;

create policy "Claimant intake snapshots are server-only."
on public.claimant_intake_snapshots for all to anon, authenticated using (false) with check (false);
create policy "Claimant checklist items are server-only."
on public.claimant_checklist_items for all to anon, authenticated using (false) with check (false);

create function public.claimant_initialize_claim_intake(
  p_claimant_user_id uuid,
  p_portal_session_id uuid,
  p_case_id uuid,
  p_expected_case_version integer,
  p_jurisdiction_key text,
  p_routing_conditions jsonb,
  p_policy_pack_id text,
  p_policy_pack_version integer,
  p_checklist_items jsonb,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_existing public.claimant_idempotency_records%rowtype;
  v_item jsonb;
  v_key_count integer;
  v_item_count integer;
  v_common_count integer;
  v_request_digest text;
  v_result jsonb;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  perform pg_advisory_xact_lock(hashtextextended('claimant:initialize-intake:' || p_case_id::text, 0));

  if p_expected_case_version < 1 or p_policy_pack_version < 1
    or p_jurisdiction_key !~ '^synthetic_jurisdiction_[a-z0-9_]{1,80}$'
    or p_policy_pack_id !~ '^synthetic_policy_[a-z0-9_]{1,100}$'
    or jsonb_typeof(p_routing_conditions) <> 'object'
    or jsonb_typeof(p_checklist_items) <> 'array' then
    raise exception 'Claim intake input is invalid.' using errcode = '22023';
  end if;

  select count(*) into v_key_count from jsonb_object_keys(p_routing_conditions);
  if v_key_count <> 6 or not p_routing_conditions ?& array[
    'probate_required', 'relationship_evidence_required', 'name_variation_present',
    'translation_required', 'attestation_required', 'dispute_known'
  ] or exists (select 1 from jsonb_each(p_routing_conditions) where jsonb_typeof(value) <> 'boolean') then
    raise exception 'Claim intake routing facts are invalid.' using errcode = '22023';
  end if;

  v_item_count := jsonb_array_length(p_checklist_items);
  if v_item_count < 7 or v_item_count > 13 then
    raise exception 'Claim intake checklist is invalid.' using errcode = '22023';
  end if;

  v_request_digest := encode(extensions.digest(concat_ws('|', p_claimant_user_id::text,
    p_case_id::text, p_expected_case_version::text, p_jurisdiction_key, p_routing_conditions::text,
    p_policy_pack_id, p_policy_pack_version::text, p_checklist_items::text), 'sha256'), 'hex');

  select * into v_existing from public.claimant_idempotency_records
  where operation = 'initialize_claim_intake' and actor_user_id = p_claimant_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was already used with different intake input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;

  select * into v_case from public.claimant_cases where id = p_case_id for update;
  if v_case.id is null or v_case.claimant_user_id <> p_claimant_user_id then
    raise exception 'Claim intake case is unavailable.' using errcode = '42501';
  end if;
  if v_case.state <> 'draft' or v_case.version <> p_expected_case_version then
    raise exception 'Claim intake case changed.' using errcode = '40001';
  end if;
  if v_case.route_profile <> 'registered_recipient_v1'
    or v_case.policy_pack_id <> p_policy_pack_id or v_case.policy_pack_version <> p_policy_pack_version then
    raise exception 'Claim intake policy binding is invalid.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.claimant_identities
      where user_id = p_claimant_user_id and status = 'active')
    or not exists (select 1 from public.claimant_case_device_keys
      where case_id = p_case_id and key_id = v_case.current_key_id
        and claimant_user_id = p_claimant_user_id and status = 'active') then
    raise exception 'Claim intake claimant binding is invalid.' using errcode = '42501';
  end if;

  insert into public.claimant_intake_snapshots (case_id, claimant_user_id, synthetic_only,
    jurisdiction_key, trigger_type, routing_conditions, policy_pack_id, policy_pack_version)
  values (p_case_id, p_claimant_user_id, true, p_jurisdiction_key, 'death',
    p_routing_conditions, p_policy_pack_id, p_policy_pack_version);

  for v_item in select value from jsonb_array_elements(p_checklist_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Claim intake checklist item is invalid.' using errcode = '22023';
    end if;
    select count(*) into v_key_count from jsonb_object_keys(v_item);
    if v_key_count <> 3
      or not v_item ?& array['item_key', 'source', 'availability']
      or v_item ->> 'source' not in ('common', 'conditional')
      or v_item ->> 'availability' <> 'pending' then
      raise exception 'Claim intake checklist item is invalid.' using errcode = '22023';
    end if;
    insert into public.claimant_checklist_items (case_id, item_key, source, availability)
    values (p_case_id, v_item ->> 'item_key', v_item ->> 'source', v_item ->> 'availability');
  end loop;

  select count(*) into v_common_count from public.claimant_checklist_items
  where case_id = p_case_id and source = 'common' and item_key in (
    'claimant_photo_identity', 'identity_verification_result', 'owner_match_reference',
    'official_death_record', 'authority_basis', 'processing_declaration', 'conflict_declaration'
  );
  if v_common_count <> 7 then
    raise exception 'Claim intake common checklist is incomplete.' using errcode = '22023';
  end if;

  update public.claimant_cases set state = 'identity_pending', version = version + 1, updated_at = now()
  where id = p_case_id and state = 'draft' and version = p_expected_case_version
  returning * into v_case;
  if v_case.id is null then raise exception 'Claim intake case changed.' using errcode = '40001'; end if;

  insert into public.claimant_audit_events (event_type, actor_user_id, case_id, idempotency_key, metadata)
  values ('claim_intake_initialized', p_claimant_user_id, p_case_id, p_idempotency_key,
    jsonb_build_object('case_version', v_case.version, 'checklist_item_count', v_item_count,
      'policy_pack_id', p_policy_pack_id, 'policy_pack_version', p_policy_pack_version));

  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'checklist_item_count', v_item_count, 'state', v_case.state, 'replayed', false);
  insert into public.claimant_idempotency_records (operation, actor_user_id, idempotency_key,
    request_digest, result) values ('initialize_claim_intake', p_claimant_user_id,
      p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
end
$function$;

revoke all on function public.claimant_initialize_claim_intake(uuid, uuid, uuid, integer,
  text, jsonb, text, integer, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.claimant_initialize_claim_intake(uuid, uuid, uuid, integer,
  text, jsonb, text, integer, jsonb, uuid) to service_role;
