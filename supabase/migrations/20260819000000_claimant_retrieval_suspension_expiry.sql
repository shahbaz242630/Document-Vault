do $drop_access_checks$
declare v_table regclass; v_column text; v_constraint record;
begin
  for v_table, v_column in values
    ('public.claimant_release_package_finalizations'::regclass, 'status'),
    ('public.claimant_release_retrieval_sessions'::regclass, 'status'),
    ('public.claimant_encrypted_package_deliveries'::regclass, 'status')
  loop
    for v_constraint in
      select constraint_row.conname
      from pg_catalog.pg_constraint constraint_row
      join pg_catalog.pg_attribute attribute_row
        on attribute_row.attrelid = constraint_row.conrelid
        and attribute_row.attnum = any(constraint_row.conkey)
      where constraint_row.conrelid = v_table and constraint_row.contype = 'c'
        and attribute_row.attname = v_column
    loop
      execute format('alter table %s drop constraint %I', v_table, v_constraint.conname);
    end loop;
  end loop;
end $drop_access_checks$;

alter table public.claimant_release_package_finalizations
add constraint claimant_release_package_finalizations_status_check check (
  status in ('finalized_release_ready', 'suspended', 'expired')
);

alter table public.claimant_release_retrieval_sessions
add column access_state text not null default 'active',
add column access_ended_at timestamptz,
add constraint claimant_release_retrieval_sessions_status_check check (status in (
  'authorized_unserved', 'delivery_prepared', 'consumed_served', 'completed_opened',
  'access_ended_unserved', 'access_ended_served_unrecalled',
  'access_ended_completed_unrecalled'
)),
add constraint claimant_release_retrieval_sessions_access_state_check check (
  (access_state = 'active' and access_ended_at is null
    and status in ('authorized_unserved', 'delivery_prepared', 'consumed_served',
      'completed_opened'))
  or (access_state in ('suspended', 'expired') and access_ended_at is not null
    and status in ('access_ended_unserved', 'access_ended_served_unrecalled',
      'access_ended_completed_unrecalled'))
),
add constraint claimant_release_retrieval_sessions_delivery_state_check check (
  (status = 'authorized_unserved' and not package_serving_authorized
    and not package_served and not retrieval_completed)
  or (status = 'delivery_prepared' and package_serving_authorized
    and not package_served and not retrieval_completed)
  or (status = 'consumed_served' and package_serving_authorized
    and package_served and not retrieval_completed)
  or (status = 'completed_opened' and package_serving_authorized
    and package_served and retrieval_completed)
  or (status = 'access_ended_unserved' and not package_serving_authorized
    and not package_served and not retrieval_completed)
  or (status = 'access_ended_served_unrecalled' and not package_serving_authorized
    and package_served and not retrieval_completed)
  or (status = 'access_ended_completed_unrecalled' and not package_serving_authorized
    and package_served and retrieval_completed)
);

alter table public.claimant_encrypted_package_deliveries
add column access_state text not null default 'active',
add column access_ended_at timestamptz,
add constraint claimant_encrypted_package_deliveries_status_check check (status in (
  'prepared_unserved', 'served', 'access_ended_unserved',
  'access_ended_served_unrecalled'
)),
add constraint claimant_encrypted_package_deliveries_access_state_check check (
  (access_state = 'active' and access_ended_at is null
    and status in ('prepared_unserved', 'served'))
  or (access_state in ('suspended', 'expired') and access_ended_at is not null
    and status in ('access_ended_unserved', 'access_ended_served_unrecalled'))
),
add constraint claimant_encrypted_package_deliveries_state_check check (
  (status in ('prepared_unserved', 'access_ended_unserved') and not package_served
    and served_at is null and receipt_ref is null and receipt_digest is null)
  or (status in ('served', 'access_ended_served_unrecalled') and package_served
    and served_at is not null and receipt_ref is not null and receipt_digest is not null)
),
add constraint claimant_encrypted_package_deliveries_completion_check check (
  not retrieval_completed
  or (status in ('served', 'access_ended_served_unrecalled') and package_served)
);

create table public.claimant_retrieval_access_controls (
  id uuid primary key,
  finalization_id uuid not null unique,
  package_id uuid not null unique,
  case_id uuid not null unique,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  control_state text not null check (control_state in ('suspended', 'expired')),
  reason text not null check (
    (control_state = 'suspended' and reason = 'synthetic_security_hold')
    or (control_state = 'expired' and reason = 'package_expired')
  ),
  source_case_version integer not null check (source_case_version > 3),
  package_was_served boolean not null,
  retrieval_was_completed boolean not null,
  future_serving_authorized boolean not null default false
    check (not future_serving_authorized),
  future_retrieval_authorized boolean not null default false
    check (not future_retrieval_authorized),
  local_content_recalled boolean not null default false check (not local_content_recalled),
  local_content_deleted boolean not null default false check (not local_content_deleted),
  effective_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  synthetic_only boolean not null default true check (synthetic_only),
  unique (id, case_id),
  foreign key (finalization_id, case_id)
    references public.claimant_release_package_finalizations(id, case_id) on delete restrict,
  foreign key (package_id, case_id)
    references public.claimant_release_packages(id, case_id) on delete restrict,
  check (recorded_at >= effective_at - interval '1 minute'),
  check (not retrieval_was_completed or package_was_served)
);

create table public.claimant_retrieval_access_control_events (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null,
  case_id uuid not null,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (
    event_type in ('retrieval_access_suspended', 'retrieval_access_expired')
  ),
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and metadata = '{}'::jsonb
  ),
  unique (control_id, event_type),
  unique (case_id, claimant_user_id, idempotency_key, event_type),
  foreign key (control_id, case_id)
    references public.claimant_retrieval_access_controls(id, case_id) on delete restrict
);

create table public.claimant_retrieval_access_control_idempotency (
  operation text not null check (operation = 'end_release_retrieval_access'),
  control_id uuid not null references public.claimant_retrieval_access_controls(id)
    on delete restrict,
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and not (result ?| array['ciphertext', 'nonce', 'manifest', 'signature', 'public_key',
      'assertion', 'challenge', 'token', 'open_session_reference'])
  ),
  created_at timestamptz not null default now(),
  primary key (operation, control_id, claimant_user_id, idempotency_key)
);

create index claimant_retrieval_access_controls_claimant_idx
on public.claimant_retrieval_access_controls (claimant_user_id, recorded_at desc);
create index claimant_retrieval_access_control_events_claimant_idx
on public.claimant_retrieval_access_control_events (claimant_user_id, occurred_at desc);
create index claimant_retrieval_access_control_idempotency_control_idx
on public.claimant_retrieval_access_control_idempotency (control_id);
create index claimant_retrieval_access_control_idempotency_case_idx
on public.claimant_retrieval_access_control_idempotency (case_id);
create index claimant_retrieval_access_control_idempotency_claimant_idx
on public.claimant_retrieval_access_control_idempotency (claimant_user_id);
create index claimant_release_retrieval_sessions_finalization_access_idx
on public.claimant_release_retrieval_sessions (finalization_id, access_state);
create index claimant_encrypted_package_deliveries_finalization_access_idx
on public.claimant_encrypted_package_deliveries (finalization_id, access_state);

revoke all on table public.claimant_retrieval_access_controls from public;
revoke all on table public.claimant_retrieval_access_controls from anon;
revoke all on table public.claimant_retrieval_access_controls from authenticated;
revoke all on table public.claimant_retrieval_access_control_events from public;
revoke all on table public.claimant_retrieval_access_control_events from anon;
revoke all on table public.claimant_retrieval_access_control_events from authenticated;
revoke all on table public.claimant_retrieval_access_control_idempotency from public;
revoke all on table public.claimant_retrieval_access_control_idempotency from anon;
revoke all on table public.claimant_retrieval_access_control_idempotency from authenticated;
grant select, insert on table public.claimant_retrieval_access_controls to service_role;
grant select, insert on table public.claimant_retrieval_access_control_events to service_role;
grant select, insert on table public.claimant_retrieval_access_control_idempotency to service_role;
grant update on table public.claimant_release_package_finalizations to service_role;

alter table public.claimant_retrieval_access_controls enable row level security;
alter table public.claimant_retrieval_access_controls force row level security;
alter table public.claimant_retrieval_access_control_events enable row level security;
alter table public.claimant_retrieval_access_control_events force row level security;
alter table public.claimant_retrieval_access_control_idempotency enable row level security;
alter table public.claimant_retrieval_access_control_idempotency force row level security;
create policy "Claimant retrieval access controls are server-only."
on public.claimant_retrieval_access_controls for all to anon, authenticated
using (false) with check (false);
create policy "Claimant retrieval access control events are server-only."
on public.claimant_retrieval_access_control_events for all to anon, authenticated
using (false) with check (false);
create policy "Claimant retrieval access control idempotency is server-only."
on public.claimant_retrieval_access_control_idempotency for all to anon, authenticated
using (false) with check (false);

create function public.claimant_end_release_retrieval_access(
  p_control_id uuid,
  p_finalization_id uuid,
  p_case_id uuid,
  p_expected_case_version integer,
  p_control_state text,
  p_reason text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz := now();
  v_case public.claimant_cases%rowtype;
  v_finalization public.claimant_release_package_finalizations%rowtype;
  v_existing public.claimant_retrieval_access_control_idempotency%rowtype;
  v_request_digest text;
  v_package_was_served boolean;
  v_retrieval_was_completed boolean;
  v_result jsonb;
begin
  if p_expected_case_version < 4
    or p_control_state not in ('suspended', 'expired')
    or not ((p_control_state = 'suspended' and p_reason = 'synthetic_security_hold')
      or (p_control_state = 'expired' and p_reason = 'package_expired')) then
    raise exception 'Retrieval access control input is invalid.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:release-retrieval-session:' || p_case_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:encrypted-package-delivery:' || p_case_id::text, 0));
  perform 1 from public.claimant_encrypted_package_deliveries
  where finalization_id = p_finalization_id and case_id = p_case_id
  order by id for update;
  perform 1 from public.claimant_release_retrieval_sessions
  where finalization_id = p_finalization_id and case_id = p_case_id
  order by id for update;
  select * into v_case from public.claimant_cases
  where id = p_case_id for update;
  select * into v_finalization from public.claimant_release_package_finalizations
  where id = p_finalization_id and case_id = p_case_id for update;
  if v_case.id is null or v_finalization.id is null
    or v_case.claimant_user_id is null then
    raise exception 'Retrieval access authority is unavailable.' using errcode = '40001';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_control_id::text,
    p_finalization_id::text, p_case_id::text, p_expected_case_version::text,
    p_control_state, p_reason), 'sha256'), 'hex');
  select * into v_existing from public.claimant_retrieval_access_control_idempotency
  where operation = 'end_release_retrieval_access'
    and control_id = p_control_id and claimant_user_id = v_case.claimant_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key input changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  if v_case.version <> p_expected_case_version
    or v_case.state not in ('release_ready', 'released')
    or not ((v_case.state = 'release_ready'
        and v_case.version = v_finalization.finalized_case_version)
      or (v_case.state = 'released'
        and v_case.version = v_finalization.finalized_case_version + 1))
    or v_finalization.status <> 'finalized_release_ready'
    or not v_finalization.manifest_signed or v_finalization.retrieval_authorized
    or not v_finalization.synthetic_only
    or (p_control_state = 'suspended' and v_finalization.expires_at <= v_now)
    or (p_control_state = 'expired' and v_finalization.expires_at > v_now) then
    raise exception 'Retrieval access control does not match current authority.'
      using errcode = '40001';
  end if;
  select exists (select 1 from public.claimant_encrypted_package_deliveries
      where finalization_id = p_finalization_id and case_id = p_case_id
        and package_served),
    exists (select 1 from public.claimant_retrieval_completions
      where case_id = p_case_id and release_package_id = v_finalization.package_id)
  into v_package_was_served, v_retrieval_was_completed;
  insert into public.claimant_retrieval_access_controls (id, finalization_id,
    package_id, case_id, claimant_user_id, control_state, reason,
    source_case_version, package_was_served, retrieval_was_completed,
    effective_at, recorded_at)
  values (p_control_id, p_finalization_id, v_finalization.package_id, p_case_id,
    v_case.claimant_user_id, p_control_state, p_reason, p_expected_case_version,
    v_package_was_served, v_retrieval_was_completed, v_now, v_now);
  update public.claimant_release_package_finalizations set status = p_control_state
  where id = p_finalization_id and status = 'finalized_release_ready';
  update public.claimant_release_retrieval_sessions set
    access_state = p_control_state, access_ended_at = v_now,
    package_serving_authorized = false,
    status = case
      when not package_served then 'access_ended_unserved'
      when retrieval_completed then 'access_ended_completed_unrecalled'
      else 'access_ended_served_unrecalled' end
  where finalization_id = p_finalization_id and case_id = p_case_id
    and access_state = 'active';
  update public.claimant_encrypted_package_deliveries set
    access_state = p_control_state, access_ended_at = v_now,
    status = case when package_served then 'access_ended_served_unrecalled'
      else 'access_ended_unserved' end
  where finalization_id = p_finalization_id and case_id = p_case_id
    and access_state = 'active';
  insert into public.claimant_retrieval_access_control_events (control_id,
    case_id, claimant_user_id, event_type, idempotency_key, occurred_at)
  values (p_control_id, p_case_id, v_case.claimant_user_id,
    case when p_control_state = 'suspended' then 'retrieval_access_suspended'
      else 'retrieval_access_expired' end, p_idempotency_key, v_now);
  v_result := jsonb_build_object('control_id', p_control_id,
    'finalization_id', p_finalization_id, 'case_id', p_case_id,
    'case_state', v_case.state, 'case_version', v_case.version,
    'control_state', p_control_state, 'package_was_served', v_package_was_served,
    'retrieval_was_completed', v_retrieval_was_completed,
    'future_serving_authorized', false, 'future_retrieval_authorized', false,
    'local_content_recalled', false, 'local_content_deleted', false,
    'effective_at', v_now, 'replayed', false);
  insert into public.claimant_retrieval_access_control_idempotency (operation,
    control_id, case_id, claimant_user_id, idempotency_key, request_digest, result)
  values ('end_release_retrieval_access', p_control_id, p_case_id,
    v_case.claimant_user_id, p_idempotency_key, v_request_digest,
    v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Retrieval access control conflicts with existing state.'
    using errcode = '40001';
end
$function$;

revoke all on function public.claimant_end_release_retrieval_access(
  uuid, uuid, uuid, integer, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_end_release_retrieval_access(
  uuid, uuid, uuid, integer, text, text, uuid
) to service_role;
