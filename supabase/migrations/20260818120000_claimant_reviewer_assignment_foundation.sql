create table public.claimant_reviewer_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  pseudonymous_ref text not null unique
    check (pseudonymous_ref ~ '^synthetic_reviewer_[a-z0-9_]{1,100}$'),
  reviewer_class text not null check (reviewer_class in (
    'accountable_human_test', 'non_human_test_actor'
  )),
  status text not null default 'active' check (status in ('active', 'suspended', 'retired')),
  synthetic_only boolean not null default true check (synthetic_only),
  live_review_authority boolean not null default false check (not live_review_authority),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at)
);

create table public.claimant_reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  cycle_id uuid not null,
  reviewer_identity_id uuid not null
    references public.claimant_reviewer_identities(id) on delete restrict,
  assignment_slot smallint not null check (assignment_slot in (1, 2)),
  assigned_case_version integer not null check (assigned_case_version > 1),
  cycle_number integer not null check (cycle_number > 0),
  status text not null check (status in ('assigned', 'conflicted', 'recused')),
  assignment_version integer not null default 1 check (assignment_version > 0),
  terminal_reason text null check (terminal_reason is null or terminal_reason in (
    'owner_relationship', 'claimant_relationship', 'case_involvement',
    'independence_concern', 'availability', 'other_conflict'
  )),
  assigned_at timestamptz not null default now(),
  terminal_at timestamptz null,
  updated_at timestamptz not null default now(),
  check (updated_at >= assigned_at),
  check ((status = 'assigned' and terminal_reason is null and terminal_at is null)
    or (status in ('conflicted', 'recused') and terminal_reason is not null
      and terminal_at is not null)),
  unique (id, case_id),
  unique (case_id, cycle_id, reviewer_identity_id),
  foreign key (cycle_id, case_id)
    references public.claimant_owner_protection_cycles(id, case_id) on delete restrict
);

create unique index claimant_reviewer_active_slot_idx
on public.claimant_reviewer_assignments (case_id, cycle_id, assignment_slot)
where status = 'assigned';

create unique index claimant_reviewer_active_identity_idx
on public.claimant_reviewer_assignments (case_id, cycle_id, reviewer_identity_id)
where status = 'assigned';

create table public.claimant_reviewer_assignment_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  assignment_id uuid not null,
  reviewer_identity_id uuid not null
    references public.claimant_reviewer_identities(id) on delete restrict,
  event_type text not null check (event_type in (
    'reviewer_assigned', 'reviewer_conflict_declared', 'reviewer_recused'
  )),
  reason_class text not null check (reason_class in (
    'not_applicable', 'owner_relationship', 'claimant_relationship', 'case_involvement',
    'independence_concern', 'availability', 'other_conflict'
  )),
  assignment_version integer not null check (assignment_version > 0),
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and metadata = '{}'::jsonb),
  unique (case_id, idempotency_key, event_type),
  foreign key (assignment_id, case_id)
    references public.claimant_reviewer_assignments(id, case_id) on delete restrict
);

create table public.claimant_reviewer_assignment_idempotency (
  operation text not null check (operation in (
    'assign_reviewer', 'declare_reviewer_conflict', 'recuse_reviewer'
  )),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (operation, case_id, idempotency_key)
);

revoke all on table public.claimant_reviewer_identities from public;
revoke all on table public.claimant_reviewer_identities from anon;
revoke all on table public.claimant_reviewer_identities from authenticated;
revoke all on table public.claimant_reviewer_assignments from public;
revoke all on table public.claimant_reviewer_assignments from anon;
revoke all on table public.claimant_reviewer_assignments from authenticated;
revoke all on table public.claimant_reviewer_assignment_events from public;
revoke all on table public.claimant_reviewer_assignment_events from anon;
revoke all on table public.claimant_reviewer_assignment_events from authenticated;
revoke all on table public.claimant_reviewer_assignment_idempotency from public;
revoke all on table public.claimant_reviewer_assignment_idempotency from anon;
revoke all on table public.claimant_reviewer_assignment_idempotency from authenticated;
grant select, insert, update on table public.claimant_reviewer_identities to service_role;
grant select, insert, update on table public.claimant_reviewer_assignments to service_role;
grant select, insert on table public.claimant_reviewer_assignment_events to service_role;
grant select, insert on table public.claimant_reviewer_assignment_idempotency to service_role;

alter table public.claimant_reviewer_identities enable row level security;
alter table public.claimant_reviewer_identities force row level security;
alter table public.claimant_reviewer_assignments enable row level security;
alter table public.claimant_reviewer_assignments force row level security;
alter table public.claimant_reviewer_assignment_events enable row level security;
alter table public.claimant_reviewer_assignment_events force row level security;
alter table public.claimant_reviewer_assignment_idempotency enable row level security;
alter table public.claimant_reviewer_assignment_idempotency force row level security;
create policy "Claimant reviewer identities are server-only."
on public.claimant_reviewer_identities for all to anon, authenticated using (false) with check (false);
create policy "Claimant reviewer assignments are server-only."
on public.claimant_reviewer_assignments for all to anon, authenticated using (false) with check (false);
create policy "Claimant reviewer assignment events are server-only."
on public.claimant_reviewer_assignment_events for all to anon, authenticated using (false) with check (false);
create policy "Claimant reviewer assignment idempotency is server-only."
on public.claimant_reviewer_assignment_idempotency for all to anon, authenticated using (false) with check (false);

create function public.claimant_assign_reviewer(
  p_case_id uuid, p_cycle_id uuid, p_expected_case_version integer,
  p_reviewer_identity_id uuid, p_assignment_slot integer, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_reviewer public.claimant_reviewer_identities%rowtype;
  v_assignment public.claimant_reviewer_assignments%rowtype;
  v_existing public.claimant_reviewer_assignment_idempotency%rowtype;
  v_digest text; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:reviewer-assignment:' || p_case_id::text, 0));
  if p_expected_case_version < 2 or p_assignment_slot not in (1, 2) then
    raise exception 'Reviewer assignment input is invalid.' using errcode = '22023';
  end if;
  v_digest := encode(extensions.digest(concat_ws('|', p_case_id::text, p_cycle_id::text,
    p_expected_case_version::text, p_reviewer_identity_id::text,
    p_assignment_slot::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_reviewer_assignment_idempotency
  where operation = 'assign_reviewer' and case_id = p_case_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Idempotency key was used with different assignment input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_cycle from public.claimant_owner_protection_cycles
  where id = p_cycle_id and case_id = p_case_id for update;
  select * into v_reviewer from public.claimant_reviewer_identities
  where id = p_reviewer_identity_id for update;
  if v_case.id is null or v_case.state <> 'cooldown' or v_case.version <> p_expected_case_version
    or v_cycle.id is null or v_cycle.status <> 'delivery_verified'
    or v_cycle.cooldown_expires_at is null or v_cycle.cooldown_expires_at > now()
    or v_cycle.owner_user_id <> v_case.owner_user_id
    or v_cycle.claimant_user_id <> v_case.claimant_user_id
    or v_cycle.policy_pack_id <> v_case.policy_pack_id
    or v_cycle.policy_pack_version <> v_case.policy_pack_version then
    raise exception 'Reviewer assignment case is unavailable.' using errcode = '40001';
  end if;
  if v_reviewer.id is null or v_reviewer.status <> 'active'
    or not v_reviewer.synthetic_only or v_reviewer.live_review_authority
    or v_reviewer.user_id in (v_case.owner_user_id, v_case.claimant_user_id) then
    raise exception 'Reviewer identity is unavailable.' using errcode = '42501';
  end if;
  if exists (select 1 from public.claimant_reviewer_assignments
      where case_id = p_case_id and cycle_id = p_cycle_id and status = 'assigned'
        and (assignment_slot = p_assignment_slot
          or reviewer_identity_id = p_reviewer_identity_id)) then
    raise exception 'Reviewer assignment conflicts with active authority.' using errcode = '40001';
  end if;
  insert into public.claimant_reviewer_assignments (case_id, cycle_id, reviewer_identity_id,
    assignment_slot, assigned_case_version, cycle_number, status)
  values (p_case_id, p_cycle_id, p_reviewer_identity_id, p_assignment_slot,
    p_expected_case_version, v_cycle.cycle_number, 'assigned') returning * into v_assignment;
  insert into public.claimant_reviewer_assignment_events (case_id, assignment_id,
    reviewer_identity_id, event_type, reason_class, assignment_version, idempotency_key)
  values (p_case_id, v_assignment.id, p_reviewer_identity_id, 'reviewer_assigned',
    'not_applicable', v_assignment.assignment_version, p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'cycle_id', p_cycle_id, 'assignment_id', v_assignment.id,
    'reviewer_identity_id', p_reviewer_identity_id, 'assignment_slot', p_assignment_slot,
    'assignment_version', v_assignment.assignment_version, 'status', v_assignment.status,
    'reason_class', null, 'reviewer_decision_recorded', false,
    'approval_counted', false, 'release_authorized', false, 'replayed', false);
  insert into public.claimant_reviewer_assignment_idempotency
    (operation, case_id, idempotency_key, request_digest, result)
  values ('assign_reviewer', p_case_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Reviewer assignment conflicts with existing authority.' using errcode = '40001';
end $function$;

create function public.claimant_declare_reviewer_conflict(
  p_case_id uuid, p_assignment_id uuid, p_reviewer_identity_id uuid,
  p_expected_case_version integer, p_expected_assignment_version integer,
  p_reason_class text, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_assignment public.claimant_reviewer_assignments%rowtype;
  v_existing public.claimant_reviewer_assignment_idempotency%rowtype;
  v_digest text; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:reviewer-assignment:' || p_case_id::text, 0));
  if p_expected_case_version < 2 or p_expected_assignment_version < 1
    or p_reason_class not in ('owner_relationship', 'claimant_relationship',
      'case_involvement', 'independence_concern', 'other_conflict') then
    raise exception 'Reviewer conflict input is invalid.' using errcode = '22023';
  end if;
  v_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_assignment_id::text, p_reviewer_identity_id::text, p_expected_case_version::text,
    p_expected_assignment_version::text, p_reason_class), 'sha256'), 'hex');
  select * into v_existing from public.claimant_reviewer_assignment_idempotency
  where operation = 'declare_reviewer_conflict' and case_id = p_case_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Idempotency key was used with different conflict input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_assignment from public.claimant_reviewer_assignments
  where id = p_assignment_id and case_id = p_case_id for update;
  if v_case.id is null or v_case.state <> 'cooldown' or v_case.version <> p_expected_case_version
    or v_assignment.id is null or v_assignment.status <> 'assigned'
    or v_assignment.reviewer_identity_id <> p_reviewer_identity_id
    or v_assignment.assignment_version <> p_expected_assignment_version then
    raise exception 'Reviewer conflict authority changed.' using errcode = '40001';
  end if;
  update public.claimant_reviewer_assignments set status = 'conflicted',
    assignment_version = assignment_version + 1, terminal_reason = p_reason_class,
    terminal_at = now(), updated_at = now()
  where id = p_assignment_id and status = 'assigned'
    and assignment_version = p_expected_assignment_version returning * into v_assignment;
  if v_assignment.id is null then
    raise exception 'Reviewer conflict authority changed.' using errcode = '40001';
  end if;
  insert into public.claimant_reviewer_assignment_events (case_id, assignment_id,
    reviewer_identity_id, event_type, reason_class, assignment_version, idempotency_key)
  values (p_case_id, p_assignment_id, p_reviewer_identity_id, 'reviewer_conflict_declared',
    p_reason_class, v_assignment.assignment_version, p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'cycle_id', v_assignment.cycle_id, 'assignment_id', v_assignment.id,
    'reviewer_identity_id', p_reviewer_identity_id,
    'assignment_slot', v_assignment.assignment_slot,
    'assignment_version', v_assignment.assignment_version, 'status', v_assignment.status,
    'reason_class', v_assignment.terminal_reason, 'reviewer_decision_recorded', false,
    'approval_counted', false, 'release_authorized', false, 'replayed', false);
  insert into public.claimant_reviewer_assignment_idempotency
    (operation, case_id, idempotency_key, request_digest, result)
  values ('declare_reviewer_conflict', p_case_id, p_idempotency_key,
    v_digest, v_result - 'replayed');
  return v_result;
end $function$;

create function public.claimant_recuse_reviewer(
  p_case_id uuid, p_assignment_id uuid, p_reviewer_identity_id uuid,
  p_expected_case_version integer, p_expected_assignment_version integer,
  p_reason_class text, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_assignment public.claimant_reviewer_assignments%rowtype;
  v_existing public.claimant_reviewer_assignment_idempotency%rowtype;
  v_digest text; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:reviewer-assignment:' || p_case_id::text, 0));
  if p_expected_case_version < 2 or p_expected_assignment_version < 1
    or p_reason_class not in ('independence_concern', 'availability', 'other_conflict') then
    raise exception 'Reviewer recusal input is invalid.' using errcode = '22023';
  end if;
  v_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_assignment_id::text, p_reviewer_identity_id::text, p_expected_case_version::text,
    p_expected_assignment_version::text, p_reason_class), 'sha256'), 'hex');
  select * into v_existing from public.claimant_reviewer_assignment_idempotency
  where operation = 'recuse_reviewer' and case_id = p_case_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Idempotency key was used with different recusal input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_assignment from public.claimant_reviewer_assignments
  where id = p_assignment_id and case_id = p_case_id for update;
  if v_case.id is null or v_case.state <> 'cooldown' or v_case.version <> p_expected_case_version
    or v_assignment.id is null or v_assignment.status <> 'assigned'
    or v_assignment.reviewer_identity_id <> p_reviewer_identity_id
    or v_assignment.assignment_version <> p_expected_assignment_version then
    raise exception 'Reviewer recusal authority changed.' using errcode = '40001';
  end if;
  update public.claimant_reviewer_assignments set status = 'recused',
    assignment_version = assignment_version + 1, terminal_reason = p_reason_class,
    terminal_at = now(), updated_at = now()
  where id = p_assignment_id and status = 'assigned'
    and assignment_version = p_expected_assignment_version returning * into v_assignment;
  if v_assignment.id is null then
    raise exception 'Reviewer recusal authority changed.' using errcode = '40001';
  end if;
  insert into public.claimant_reviewer_assignment_events (case_id, assignment_id,
    reviewer_identity_id, event_type, reason_class, assignment_version, idempotency_key)
  values (p_case_id, p_assignment_id, p_reviewer_identity_id, 'reviewer_recused',
    p_reason_class, v_assignment.assignment_version, p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'cycle_id', v_assignment.cycle_id, 'assignment_id', v_assignment.id,
    'reviewer_identity_id', p_reviewer_identity_id,
    'assignment_slot', v_assignment.assignment_slot,
    'assignment_version', v_assignment.assignment_version, 'status', v_assignment.status,
    'reason_class', v_assignment.terminal_reason, 'reviewer_decision_recorded', false,
    'approval_counted', false, 'release_authorized', false, 'replayed', false);
  insert into public.claimant_reviewer_assignment_idempotency
    (operation, case_id, idempotency_key, request_digest, result)
  values ('recuse_reviewer', p_case_id, p_idempotency_key,
    v_digest, v_result - 'replayed');
  return v_result;
end $function$;

revoke all on function public.claimant_assign_reviewer(uuid, uuid, integer, uuid, integer, uuid)
from public, anon, authenticated;
grant execute on function public.claimant_assign_reviewer(uuid, uuid, integer, uuid, integer, uuid)
to service_role;
revoke all on function public.claimant_declare_reviewer_conflict(
  uuid, uuid, uuid, integer, integer, text, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_declare_reviewer_conflict(
  uuid, uuid, uuid, integer, integer, text, uuid
) to service_role;
revoke all on function public.claimant_recuse_reviewer(
  uuid, uuid, uuid, integer, integer, text, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_recuse_reviewer(
  uuid, uuid, uuid, integer, integer, text, uuid
) to service_role;
