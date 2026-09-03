create table public.claimant_release_authority_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  pseudonymous_ref text not null unique
    check (pseudonymous_ref ~ '^synthetic_release_authority_[a-z0-9_]{1,100}$'),
  authority_class text not null check (authority_class = 'release_test_authorizer'),
  status text not null default 'active' check (status in ('active', 'suspended', 'retired')),
  synthetic_only boolean not null default true check (synthetic_only),
  live_release_authority boolean not null default false check (not live_release_authority),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at)
);

create table public.claimant_release_authorizations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  cycle_id uuid not null,
  review_round_id uuid not null,
  authority_identity_id uuid not null
    references public.claimant_release_authority_identities(id) on delete restrict,
  source_case_version integer not null check (source_case_version > 1),
  authorized_case_version integer not null check (
    authorized_case_version = source_case_version + 1
  ),
  binding_version integer not null check (binding_version > 0),
  finalization_version integer not null check (finalization_version > 0),
  submission_case_version integer not null check (submission_case_version > 1),
  review_round_version integer not null check (review_round_version > 1),
  policy_pack_id text not null check (policy_pack_id ~ '^synthetic_policy_[a-z0-9_]{1,100}$'),
  policy_pack_version integer not null check (policy_pack_version > 0),
  reason_class text not null default 'all_release_prerequisites_revalidated'
    check (reason_class = 'all_release_prerequisites_revalidated'),
  status text not null default 'authorized' check (status = 'authorized'),
  release_authorized boolean not null default true check (release_authorized),
  package_creation_authorized boolean not null default false
    check (not package_creation_authorized),
  retrieval_authorized boolean not null default false check (not retrieval_authorized),
  synthetic_only boolean not null default true check (synthetic_only),
  authorized_at timestamptz not null default now(),
  unique (case_id),
  unique (review_round_id),
  unique (id, case_id),
  foreign key (cycle_id, case_id)
    references public.claimant_owner_protection_cycles(id, case_id) on delete restrict,
  foreign key (review_round_id, case_id)
    references public.claimant_review_rounds(id, case_id) on delete restrict,
  foreign key (case_id, submission_case_version)
    references public.claimant_submission_receipts(case_id, case_version) on delete restrict
);

create table public.claimant_release_authorization_events (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null,
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  authority_identity_id uuid not null
    references public.claimant_release_authority_identities(id) on delete restrict,
  event_type text not null check (event_type = 'release_authorized'),
  reason_class text not null check (reason_class = 'all_release_prerequisites_revalidated'),
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and metadata = '{}'::jsonb),
  unique (case_id, idempotency_key, event_type),
  foreign key (authorization_id, case_id)
    references public.claimant_release_authorizations(id, case_id) on delete restrict
);

create table public.claimant_release_authorization_idempotency (
  operation text not null check (operation = 'authorize_claimant_release'),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  authority_identity_id uuid not null
    references public.claimant_release_authority_identities(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (operation, case_id, authority_identity_id, idempotency_key)
);

create index claimant_release_authorizations_cycle_case_idx
on public.claimant_release_authorizations (cycle_id, case_id);
create index claimant_release_authorizations_authority_idx
on public.claimant_release_authorizations (authority_identity_id);
create index claimant_release_authorization_events_authorization_case_idx
on public.claimant_release_authorization_events (authorization_id, case_id);
create index claimant_release_authorization_events_authority_idx
on public.claimant_release_authorization_events (authority_identity_id);
create index claimant_release_authorization_idempotency_authority_idx
on public.claimant_release_authorization_idempotency (authority_identity_id);

revoke all on table public.claimant_release_authority_identities from public;
revoke all on table public.claimant_release_authority_identities from anon;
revoke all on table public.claimant_release_authority_identities from authenticated;
revoke all on table public.claimant_release_authorizations from public;
revoke all on table public.claimant_release_authorizations from anon;
revoke all on table public.claimant_release_authorizations from authenticated;
revoke all on table public.claimant_release_authorization_events from public;
revoke all on table public.claimant_release_authorization_events from anon;
revoke all on table public.claimant_release_authorization_events from authenticated;
revoke all on table public.claimant_release_authorization_idempotency from public;
revoke all on table public.claimant_release_authorization_idempotency from anon;
revoke all on table public.claimant_release_authorization_idempotency from authenticated;
grant select, insert, update on table public.claimant_release_authority_identities to service_role;
grant select, insert on table public.claimant_release_authorizations to service_role;
grant select, insert on table public.claimant_release_authorization_events to service_role;
grant select, insert on table public.claimant_release_authorization_idempotency to service_role;

alter table public.claimant_release_authority_identities enable row level security;
alter table public.claimant_release_authority_identities force row level security;
alter table public.claimant_release_authorizations enable row level security;
alter table public.claimant_release_authorizations force row level security;
alter table public.claimant_release_authorization_events enable row level security;
alter table public.claimant_release_authorization_events force row level security;
alter table public.claimant_release_authorization_idempotency enable row level security;
alter table public.claimant_release_authorization_idempotency force row level security;
create policy "Claimant release authority identities are server-only."
on public.claimant_release_authority_identities for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release authorizations are server-only."
on public.claimant_release_authorizations for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release authorization events are server-only."
on public.claimant_release_authorization_events for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release authorization idempotency is server-only."
on public.claimant_release_authorization_idempotency for all to anon, authenticated
using (false) with check (false);

create function public.claimant_authorize_release(
  p_case_id uuid, p_cycle_id uuid, p_review_round_id uuid,
  p_authority_identity_id uuid, p_expected_case_version integer,
  p_expected_round_version integer, p_expected_binding_version integer,
  p_expected_finalization_version integer, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_round public.claimant_review_rounds%rowtype;
  v_receipt public.claimant_submission_receipts%rowtype;
  v_authority public.claimant_release_authority_identities%rowtype;
  v_authorization public.claimant_release_authorizations%rowtype;
  v_existing public.claimant_release_authorization_idempotency%rowtype;
  v_request_digest text; v_result jsonb;
  v_active_key_count integer; v_active_grant_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:release-authorization:' || p_case_id::text, 0));
  if p_expected_case_version < 2 or p_expected_round_version < 2
    or p_expected_binding_version < 1 or p_expected_finalization_version < 1 then
    raise exception 'Release authorization input is invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_cycle_id::text, p_review_round_id::text, p_authority_identity_id::text,
    p_expected_case_version::text, p_expected_round_version::text,
    p_expected_binding_version::text, p_expected_finalization_version::text),
    'sha256'), 'hex');
  select * into v_existing from public.claimant_release_authorization_idempotency
  where operation = 'authorize_claimant_release' and case_id = p_case_id
    and authority_identity_id = p_authority_identity_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was used with different release input.'
        using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_cycle from public.claimant_owner_protection_cycles
  where id = p_cycle_id and case_id = p_case_id for update;
  select * into v_round from public.claimant_review_rounds
  where id = p_review_round_id and case_id = p_case_id for update;
  select * into v_receipt from public.claimant_submission_receipts
  where case_id = p_case_id;
  select * into v_authority from public.claimant_release_authority_identities
  where id = p_authority_identity_id for update;
  if v_case.id is null or v_case.state <> 'cooldown'
    or v_case.version <> p_expected_case_version
    or v_case.binding_version <> p_expected_binding_version
    or v_case.finalization_version <> p_expected_finalization_version
    or v_case.owner_finalized_at is null
    or v_cycle.id is null or v_cycle.status <> 'delivery_verified'
    or v_cycle.cooldown_expires_at is null or v_cycle.cooldown_expires_at > now()
    or v_cycle.owner_user_id <> v_case.owner_user_id
    or v_cycle.claimant_user_id <> v_case.claimant_user_id
    or v_cycle.policy_pack_id <> v_case.policy_pack_id
    or v_cycle.policy_pack_version <> v_case.policy_pack_version
    or v_round.id is null or v_round.cycle_id <> p_cycle_id
    or v_round.case_version <> p_expected_case_version
    or v_round.round_version <> p_expected_round_version
    or v_round.status <> 'two_person_approved'
    or not v_round.two_person_approval_satisfied or v_round.release_authorized
    or v_round.policy_pack_id <> v_case.policy_pack_id
    or v_round.policy_pack_version <> v_case.policy_pack_version
    or v_receipt.case_id is null
    or v_receipt.case_version <> v_round.submission_case_version
    or v_receipt.status <> 'received_for_review'
    or v_receipt.review_started or v_receipt.release_authorized
    or v_authority.id is null or v_authority.status <> 'active'
    or v_authority.authority_class <> 'release_test_authorizer'
    or not v_authority.synthetic_only or v_authority.live_release_authority
    or v_authority.user_id in (v_case.owner_user_id, v_case.claimant_user_id)
    or exists (select 1 from public.claimant_reviewer_identities reviewer
      where reviewer.user_id = v_authority.user_id)
    or exists (select 1 from public.claimant_review_resolution_authorities resolution
      where resolution.user_id = v_authority.user_id) then
    raise exception 'Release authorization authority changed.' using errcode = '42501';
  end if;
  if exists (select 1 from public.claimant_review_interventions intervention
      where intervention.case_id = p_case_id)
    or (select count(*) from public.claimant_review_decisions decision
      where decision.review_round_id = p_review_round_id) <> 2
    or exists (select 1 from public.claimant_review_decisions decision
      join public.claimant_reviewer_assignments assignment
        on assignment.id = decision.assignment_id and assignment.case_id = decision.case_id
      join public.claimant_reviewer_identities reviewer
        on reviewer.id = decision.reviewer_identity_id
      where decision.review_round_id = p_review_round_id
        and (decision.decision <> 'allow' or assignment.cycle_id <> p_cycle_id
          or assignment.status <> 'assigned'
          or assignment.assignment_version <> decision.assignment_version
          or assignment.reviewer_identity_id <> decision.reviewer_identity_id
          or reviewer.status <> 'active' or not reviewer.synthetic_only
          or reviewer.live_review_authority)) then
    raise exception 'Release review authority changed.' using errcode = '40001';
  end if;
  select count(*) into v_active_key_count
  from public.claimant_case_device_keys case_key
  join public.claimant_device_keys device_key
    on device_key.id = case_key.key_id
      and device_key.claimant_user_id = case_key.claimant_user_id
  where case_key.case_id = p_case_id and case_key.claimant_user_id = v_case.claimant_user_id
    and case_key.status = 'active' and device_key.status = 'active';
  select count(*) into v_active_grant_count
  from public.claimant_recipient_grants grant_record
  join public.claimant_case_device_keys case_key
    on case_key.case_id = grant_record.case_id
      and case_key.key_id = grant_record.recipient_key_id
      and case_key.claimant_user_id = grant_record.claimant_user_id
  join public.claimant_device_keys device_key
    on device_key.id = case_key.key_id
      and device_key.claimant_user_id = case_key.claimant_user_id
  where grant_record.case_id = p_case_id and grant_record.status = 'active'
    and grant_record.owner_user_id = v_case.owner_user_id
    and grant_record.claimant_user_id = v_case.claimant_user_id
    and case_key.status = 'active' and device_key.status = 'active'
    and grant_record.recipient_key_version = device_key.key_version;
  if v_active_key_count < 2 or v_active_grant_count <> v_active_key_count
    or not exists (select 1 from public.claimant_case_device_keys case_key
      join public.claimant_device_keys device_key on device_key.id = case_key.key_id
      where case_key.case_id = p_case_id and case_key.key_id = v_case.current_key_id
        and case_key.claimant_user_id = v_case.claimant_user_id
        and case_key.status = 'active' and device_key.status = 'active')
    or exists (select 1 from public.claimant_case_device_keys case_key
      join public.claimant_device_keys device_key on device_key.id = case_key.key_id
      where case_key.case_id = p_case_id and case_key.status = 'active'
        and device_key.status = 'active'
        and not exists (select 1 from public.claimant_recipient_grants grant_record
          where grant_record.case_id = p_case_id and grant_record.status = 'active'
            and grant_record.recipient_key_id = device_key.id
            and grant_record.recipient_key_version = device_key.key_version))
    or exists (select 1 from public.claimant_recipient_grants grant_record
      where grant_record.case_id = p_case_id and grant_record.status = 'active'
        and not exists (select 1 from public.claimant_case_device_keys case_key
          join public.claimant_device_keys device_key on device_key.id = case_key.key_id
          where case_key.case_id = p_case_id
            and case_key.key_id = grant_record.recipient_key_id
            and case_key.status = 'active' and device_key.status = 'active'
            and device_key.key_version = grant_record.recipient_key_version)) then
    raise exception 'Release recipient authority changed.' using errcode = '40001';
  end if;
  insert into public.claimant_release_authorizations (case_id, cycle_id, review_round_id,
    authority_identity_id, source_case_version, authorized_case_version, binding_version,
    finalization_version, submission_case_version, review_round_version,
    policy_pack_id, policy_pack_version)
  values (p_case_id, p_cycle_id, p_review_round_id, p_authority_identity_id,
    p_expected_case_version, p_expected_case_version + 1, p_expected_binding_version,
    p_expected_finalization_version, v_round.submission_case_version,
    p_expected_round_version, v_case.policy_pack_id, v_case.policy_pack_version)
  returning * into v_authorization;
  update public.claimant_cases set state = 'approved', version = version + 1,
    updated_at = now()
  where id = p_case_id and state = 'cooldown' and version = p_expected_case_version
    and binding_version = p_expected_binding_version
    and finalization_version = p_expected_finalization_version
  returning * into v_case;
  if v_case.id is null then
    raise exception 'Release case changed during authorization.' using errcode = '40001';
  end if;
  insert into public.claimant_release_authorization_events (authorization_id, case_id,
    authority_identity_id, event_type, reason_class, idempotency_key)
  values (v_authorization.id, p_case_id, p_authority_identity_id,
    'release_authorized', 'all_release_prerequisites_revalidated', p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'case_state', v_case.state, 'cycle_id', p_cycle_id,
    'review_round_id', p_review_round_id, 'release_authorization_id', v_authorization.id,
    'release_status', v_authorization.status, 'release_authorized', true,
    'package_creation_authorized', false, 'retrieval_authorized', false,
    'replayed', false);
  insert into public.claimant_release_authorization_idempotency (operation, case_id,
    authority_identity_id, idempotency_key, request_digest, result)
  values ('authorize_claimant_release', p_case_id, p_authority_identity_id,
    p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Release authorization conflicts with existing authority.'
    using errcode = '40001';
end $function$;

revoke all on function public.claimant_authorize_release(
  uuid, uuid, uuid, uuid, integer, integer, integer, integer, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_authorize_release(
  uuid, uuid, uuid, uuid, integer, integer, integer, integer, uuid
) to service_role;
