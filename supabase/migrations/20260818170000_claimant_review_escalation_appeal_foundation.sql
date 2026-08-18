create table public.claimant_review_resolution_authorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  pseudonymous_ref text not null unique
    check (pseudonymous_ref ~ '^synthetic_resolution_authority_[a-z0-9_]{1,100}$'),
  authority_class text not null check (authority_class in (
    'escalation_test_operator', 'appeal_test_operator'
  )),
  status text not null default 'active' check (status in ('active', 'suspended', 'retired')),
  synthetic_only boolean not null default true check (synthetic_only),
  live_resolution_authority boolean not null default false
    check (not live_resolution_authority),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at)
);

create table public.claimant_review_interventions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  cycle_id uuid not null,
  review_round_id uuid not null,
  authority_identity_id uuid not null
    references public.claimant_review_resolution_authorities(id) on delete restrict,
  intervention_type text not null check (intervention_type in ('escalation', 'appeal')),
  reason_class text not null check (reason_class in (
    'independence_concern', 'procedural_error', 'new_material_information',
    'conflict_or_dispute', 'policy_review_required'
  )),
  source_review_status text not null check (source_review_status in (
    'pending', 'two_person_approved', 'rejected', 'held'
  )),
  source_round_version integer not null check (source_round_version > 0),
  status text not null default 'open' check (status = 'open'),
  release_authorized boolean not null default false check (not release_authorized),
  synthetic_only boolean not null default true check (synthetic_only),
  opened_at timestamptz not null default now(),
  unique (review_round_id),
  unique (id, case_id),
  foreign key (review_round_id, case_id)
    references public.claimant_review_rounds(id, case_id) on delete restrict,
  foreign key (cycle_id, case_id)
    references public.claimant_owner_protection_cycles(id, case_id) on delete restrict
);

create table public.claimant_review_intervention_events (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null,
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  authority_identity_id uuid not null
    references public.claimant_review_resolution_authorities(id) on delete restrict,
  event_type text not null check (event_type in ('review_escalated', 'review_appealed')),
  reason_class text not null,
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and metadata = '{}'::jsonb),
  unique (case_id, idempotency_key, event_type),
  foreign key (intervention_id, case_id)
    references public.claimant_review_interventions(id, case_id) on delete restrict
);

create table public.claimant_review_intervention_idempotency (
  operation text not null check (operation = 'open_review_intervention'),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  authority_identity_id uuid not null
    references public.claimant_review_resolution_authorities(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (operation, case_id, authority_identity_id, idempotency_key)
);

create index claimant_review_interventions_case_idx
on public.claimant_review_interventions (case_id);
create index claimant_review_interventions_cycle_case_idx
on public.claimant_review_interventions (cycle_id, case_id);
create index claimant_review_interventions_authority_idx
on public.claimant_review_interventions (authority_identity_id);
create index claimant_review_intervention_events_intervention_case_idx
on public.claimant_review_intervention_events (intervention_id, case_id);
create index claimant_review_intervention_events_authority_idx
on public.claimant_review_intervention_events (authority_identity_id);
create index claimant_review_intervention_idempotency_authority_idx
on public.claimant_review_intervention_idempotency (authority_identity_id);

revoke all on table public.claimant_review_resolution_authorities from public;
revoke all on table public.claimant_review_resolution_authorities from anon;
revoke all on table public.claimant_review_resolution_authorities from authenticated;
revoke all on table public.claimant_review_interventions from public;
revoke all on table public.claimant_review_interventions from anon;
revoke all on table public.claimant_review_interventions from authenticated;
revoke all on table public.claimant_review_intervention_events from public;
revoke all on table public.claimant_review_intervention_events from anon;
revoke all on table public.claimant_review_intervention_events from authenticated;
revoke all on table public.claimant_review_intervention_idempotency from public;
revoke all on table public.claimant_review_intervention_idempotency from anon;
revoke all on table public.claimant_review_intervention_idempotency from authenticated;
grant select, insert, update on table public.claimant_review_resolution_authorities to service_role;
grant select, insert on table public.claimant_review_interventions to service_role;
grant select, insert on table public.claimant_review_intervention_events to service_role;
grant select, insert on table public.claimant_review_intervention_idempotency to service_role;

alter table public.claimant_review_resolution_authorities enable row level security;
alter table public.claimant_review_resolution_authorities force row level security;
alter table public.claimant_review_interventions enable row level security;
alter table public.claimant_review_interventions force row level security;
alter table public.claimant_review_intervention_events enable row level security;
alter table public.claimant_review_intervention_events force row level security;
alter table public.claimant_review_intervention_idempotency enable row level security;
alter table public.claimant_review_intervention_idempotency force row level security;
create policy "Claimant review resolution authorities are server-only."
on public.claimant_review_resolution_authorities for all to anon, authenticated
using (false) with check (false);
create policy "Claimant review interventions are server-only."
on public.claimant_review_interventions for all to anon, authenticated
using (false) with check (false);
create policy "Claimant review intervention events are server-only."
on public.claimant_review_intervention_events for all to anon, authenticated
using (false) with check (false);
create policy "Claimant review intervention idempotency is server-only."
on public.claimant_review_intervention_idempotency for all to anon, authenticated
using (false) with check (false);

create function public.claimant_open_review_intervention(
  p_case_id uuid, p_cycle_id uuid, p_review_round_id uuid,
  p_authority_identity_id uuid, p_expected_case_version integer,
  p_expected_round_version integer, p_intervention_type text,
  p_reason_class text, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_round public.claimant_review_rounds%rowtype;
  v_authority public.claimant_review_resolution_authorities%rowtype;
  v_intervention public.claimant_review_interventions%rowtype;
  v_existing public.claimant_review_intervention_idempotency%rowtype;
  v_request_digest text; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:review-intervention:' || p_case_id::text, 0));
  if p_expected_case_version < 2 or p_expected_round_version < 1
    or p_intervention_type not in ('escalation', 'appeal')
    or p_reason_class not in ('independence_concern', 'procedural_error',
      'new_material_information', 'conflict_or_dispute', 'policy_review_required') then
    raise exception 'Review intervention input is invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_cycle_id::text, p_review_round_id::text, p_authority_identity_id::text,
    p_expected_case_version::text, p_expected_round_version::text,
    p_intervention_type, p_reason_class), 'sha256'), 'hex');
  select * into v_existing from public.claimant_review_intervention_idempotency
  where operation = 'open_review_intervention' and case_id = p_case_id
    and authority_identity_id = p_authority_identity_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was used with different intervention input.'
        using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_round from public.claimant_review_rounds
  where id = p_review_round_id and case_id = p_case_id for update;
  select * into v_authority from public.claimant_review_resolution_authorities
  where id = p_authority_identity_id for update;
  if v_case.id is null or v_case.state <> 'cooldown'
    or v_case.version <> p_expected_case_version
    or v_round.id is null or v_round.cycle_id <> p_cycle_id
    or v_round.case_version <> p_expected_case_version
    or v_round.round_version <> p_expected_round_version
    or v_round.release_authorized
    or v_authority.id is null or v_authority.status <> 'active'
    or not v_authority.synthetic_only or v_authority.live_resolution_authority
    or v_authority.user_id in (v_case.owner_user_id, v_case.claimant_user_id)
    or exists (select 1 from public.claimant_reviewer_identities reviewer
      where reviewer.user_id = v_authority.user_id)
    or exists (select 1 from public.claimant_reviewer_assignments assignment
      join public.claimant_reviewer_identities reviewer
        on reviewer.id = assignment.reviewer_identity_id
      where assignment.case_id = p_case_id and assignment.cycle_id = p_cycle_id
        and reviewer.user_id = v_authority.user_id) then
    raise exception 'Review intervention authority changed.' using errcode = '42501';
  end if;
  if (p_intervention_type = 'escalation'
      and v_authority.authority_class <> 'escalation_test_operator')
    or (p_intervention_type = 'appeal'
      and (v_authority.authority_class <> 'appeal_test_operator'
        or v_round.status not in ('rejected', 'held'))) then
    raise exception 'Review intervention authority is unavailable.' using errcode = '42501';
  end if;
  insert into public.claimant_review_interventions (case_id, cycle_id, review_round_id,
    authority_identity_id, intervention_type, reason_class, source_review_status,
    source_round_version)
  values (p_case_id, p_cycle_id, p_review_round_id, p_authority_identity_id,
    p_intervention_type, p_reason_class, v_round.status, v_round.round_version)
  returning * into v_intervention;
  update public.claimant_review_rounds set status = 'held',
    two_person_approval_satisfied = false, release_authorized = false,
    round_version = round_version + 1,
    completed_at = coalesce(completed_at, now()), updated_at = now()
  where id = p_review_round_id and case_id = p_case_id
    and round_version = p_expected_round_version returning * into v_round;
  if v_round.id is null then
    raise exception 'Review round changed during intervention.' using errcode = '40001';
  end if;
  insert into public.claimant_review_intervention_events (intervention_id, case_id,
    authority_identity_id, event_type, reason_class, idempotency_key)
  values (v_intervention.id, p_case_id, p_authority_identity_id,
    case when p_intervention_type = 'escalation' then 'review_escalated'
      else 'review_appealed' end, p_reason_class, p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id,
    'case_version', v_case.version, 'cycle_id', p_cycle_id,
    'review_round_id', v_round.id, 'round_version', v_round.round_version,
    'review_status', v_round.status, 'intervention_id', v_intervention.id,
    'intervention_type', v_intervention.intervention_type,
    'intervention_status', v_intervention.status,
    'two_person_approval_satisfied', false, 'release_authorized', false,
    'replayed', false);
  insert into public.claimant_review_intervention_idempotency (operation, case_id,
    authority_identity_id, idempotency_key, request_digest, result)
  values ('open_review_intervention', p_case_id, p_authority_identity_id,
    p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Review intervention conflicts with existing authority.'
    using errcode = '40001';
end $function$;

revoke all on function public.claimant_open_review_intervention(
  uuid, uuid, uuid, uuid, integer, integer, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_open_review_intervention(
  uuid, uuid, uuid, uuid, integer, integer, text, text, uuid
) to service_role;
