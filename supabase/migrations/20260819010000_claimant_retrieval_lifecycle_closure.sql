create table public.claimant_retrieval_lifecycle_closures (
  id uuid primary key,
  completion_id uuid not null unique,
  delivery_id uuid not null unique,
  retrieval_session_id uuid not null unique,
  case_id uuid not null unique,
  release_package_id uuid not null unique,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  closure_reason text not null check (closure_reason = 'retrieval_lifecycle_complete'),
  source_case_version integer not null check (source_case_version >= 5),
  export_performed boolean not null default false,
  export_receipt_digest text null
    check (export_receipt_digest is null or export_receipt_digest ~ '^[0-9a-f]{64}$'),
  verified_export_fact_digest text null
    check (verified_export_fact_digest is null or verified_export_fact_digest ~ '^[0-9a-f]{64}$'),
  exported_at timestamptz null,
  closure_recorded boolean not null default true check (closure_recorded),
  local_content_recalled boolean not null default false check (not local_content_recalled),
  local_content_deleted boolean not null default false check (not local_content_deleted),
  historical_delivery_preserved boolean not null default true
    check (historical_delivery_preserved),
  historical_completion_preserved boolean not null default true
    check (historical_completion_preserved),
  closed_at timestamptz not null default now(),
  synthetic_only boolean not null default true check (synthetic_only),
  unique (id, case_id),
  foreign key (completion_id, case_id)
    references public.claimant_retrieval_completions(id, case_id) on delete restrict,
  foreign key (delivery_id, case_id)
    references public.claimant_encrypted_package_deliveries(id, case_id) on delete restrict,
  foreign key (retrieval_session_id, case_id)
    references public.claimant_release_retrieval_sessions(id, case_id) on delete restrict,
  foreign key (release_package_id, case_id)
    references public.claimant_release_packages(id, case_id) on delete restrict,
  check (
    (export_performed and export_receipt_digest is not null
      and verified_export_fact_digest is not null and exported_at is not null)
    or (not export_performed and export_receipt_digest is null
      and verified_export_fact_digest is null and exported_at is null)
  ),
  check (exported_at is null or exported_at <= closed_at + interval '1 minute')
);

create table public.claimant_retrieval_lifecycle_closure_events (
  id uuid primary key default gen_random_uuid(),
  closure_id uuid not null,
  case_id uuid not null,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type = 'retrieval_lifecycle_closed'),
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and metadata = '{}'::jsonb
  ),
  unique (closure_id, event_type),
  unique (case_id, claimant_user_id, idempotency_key, event_type),
  foreign key (closure_id, case_id)
    references public.claimant_retrieval_lifecycle_closures(id, case_id) on delete restrict
);

create table public.claimant_retrieval_lifecycle_closure_idempotency (
  operation text not null check (operation = 'close_retrieval_lifecycle'),
  closure_id uuid not null references public.claimant_retrieval_lifecycle_closures(id)
    on delete restrict,
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and not (result ?| array['ciphertext', 'nonce', 'manifest', 'signature', 'public_key',
      'assertion', 'challenge', 'token', 'receipt_reference', 'plaintext'])
  ),
  created_at timestamptz not null default now(),
  primary key (operation, closure_id, claimant_user_id, idempotency_key)
);

create index claimant_retrieval_lifecycle_closures_case_claimant_idx
on public.claimant_retrieval_lifecycle_closures (case_id, claimant_user_id);
create index claimant_retrieval_lifecycle_closures_claimant_idx
on public.claimant_retrieval_lifecycle_closures (claimant_user_id);
create index claimant_retrieval_lifecycle_closure_events_claimant_idx
on public.claimant_retrieval_lifecycle_closure_events (claimant_user_id, occurred_at desc);
create index claimant_retrieval_lifecycle_closure_idempotency_case_idx
on public.claimant_retrieval_lifecycle_closure_idempotency (case_id);
create index claimant_retrieval_lifecycle_closure_idempotency_closure_idx
on public.claimant_retrieval_lifecycle_closure_idempotency (closure_id);
create index claimant_retrieval_lifecycle_closure_idempotency_claimant_idx
on public.claimant_retrieval_lifecycle_closure_idempotency (claimant_user_id);

revoke all on table public.claimant_retrieval_lifecycle_closures from public;
revoke all on table public.claimant_retrieval_lifecycle_closures from anon;
revoke all on table public.claimant_retrieval_lifecycle_closures from authenticated;
revoke all on table public.claimant_retrieval_lifecycle_closure_events from public;
revoke all on table public.claimant_retrieval_lifecycle_closure_events from anon;
revoke all on table public.claimant_retrieval_lifecycle_closure_events from authenticated;
revoke all on table public.claimant_retrieval_lifecycle_closure_idempotency from public;
revoke all on table public.claimant_retrieval_lifecycle_closure_idempotency from anon;
revoke all on table public.claimant_retrieval_lifecycle_closure_idempotency from authenticated;
grant select, insert on table public.claimant_retrieval_lifecycle_closures to service_role;
grant select, insert on table public.claimant_retrieval_lifecycle_closure_events to service_role;
grant select, insert on table public.claimant_retrieval_lifecycle_closure_idempotency to service_role;

alter table public.claimant_retrieval_lifecycle_closures enable row level security;
alter table public.claimant_retrieval_lifecycle_closures force row level security;
alter table public.claimant_retrieval_lifecycle_closure_events enable row level security;
alter table public.claimant_retrieval_lifecycle_closure_events force row level security;
alter table public.claimant_retrieval_lifecycle_closure_idempotency enable row level security;
alter table public.claimant_retrieval_lifecycle_closure_idempotency force row level security;
create policy "Claimant retrieval lifecycle closures are server-only."
on public.claimant_retrieval_lifecycle_closures for all to anon, authenticated
using (false) with check (false);
create policy "Claimant retrieval lifecycle closure events are server-only."
on public.claimant_retrieval_lifecycle_closure_events for all to anon, authenticated
using (false) with check (false);
create policy "Claimant closure idempotency is server-only."
on public.claimant_retrieval_lifecycle_closure_idempotency for all to anon, authenticated
using (false) with check (false);

create function public.claimant_close_retrieval_lifecycle(
  p_closure_id uuid,
  p_completion_id uuid,
  p_delivery_id uuid,
  p_retrieval_session_id uuid,
  p_case_id uuid,
  p_release_package_id uuid,
  p_expected_case_version integer,
  p_closure_reason text,
  p_export_performed boolean,
  p_export_receipt_digest text,
  p_verified_export_fact_digest text,
  p_exported_at timestamptz,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz := now();
  v_case public.claimant_cases%rowtype;
  v_completion public.claimant_retrieval_completions%rowtype;
  v_delivery public.claimant_encrypted_package_deliveries%rowtype;
  v_session public.claimant_release_retrieval_sessions%rowtype;
  v_existing public.claimant_retrieval_lifecycle_closure_idempotency%rowtype;
  v_request_digest text;
  v_result jsonb;
begin
  if p_expected_case_version < 5
    or p_closure_reason <> 'retrieval_lifecycle_complete'
    or p_export_performed is null
    or (p_export_performed and (p_export_receipt_digest is null
      or p_export_receipt_digest !~ '^[0-9a-f]{64}$'
      or p_verified_export_fact_digest is null
      or p_verified_export_fact_digest !~ '^[0-9a-f]{64}$' or p_exported_at is null))
    or (not p_export_performed and (p_export_receipt_digest is not null
      or p_verified_export_fact_digest is not null or p_exported_at is not null)) then
    raise exception 'Retrieval lifecycle closure input is invalid.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:release-retrieval-session:' || p_case_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:encrypted-package-delivery:' || p_case_id::text, 0));
  select * into v_delivery from public.claimant_encrypted_package_deliveries
  where id = p_delivery_id and retrieval_session_id = p_retrieval_session_id
    and case_id = p_case_id and package_id = p_release_package_id for update;
  select * into v_session from public.claimant_release_retrieval_sessions
  where id = p_retrieval_session_id and case_id = p_case_id
    and package_id = p_release_package_id for update;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_completion from public.claimant_retrieval_completions
  where id = p_completion_id and delivery_id = p_delivery_id
    and retrieval_session_id = p_retrieval_session_id and case_id = p_case_id
    and release_package_id = p_release_package_id;
  if v_case.id is null or v_completion.id is null or v_delivery.id is null
    or v_session.id is null or v_case.claimant_user_id is null then
    raise exception 'Completed retrieval authority is unavailable.' using errcode = '40001';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_closure_id::text,
    p_completion_id::text, p_delivery_id::text, p_retrieval_session_id::text,
    p_case_id::text, p_release_package_id::text, p_expected_case_version::text,
    p_closure_reason, p_export_performed::text, p_export_receipt_digest,
    p_verified_export_fact_digest,
    coalesce(to_char(p_exported_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '')),
    'sha256'), 'hex');
  select * into v_existing from public.claimant_retrieval_lifecycle_closure_idempotency
  where operation = 'close_retrieval_lifecycle' and closure_id = p_closure_id
    and claimant_user_id = v_case.claimant_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key input changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  if v_case.state <> 'released' or v_case.version <> p_expected_case_version
    or v_completion.claimant_user_id <> v_case.claimant_user_id
    or v_delivery.claimant_user_id <> v_case.claimant_user_id
    or v_session.claimant_user_id <> v_case.claimant_user_id
    or v_delivery.access_state <> v_session.access_state
    or not v_delivery.package_served or not v_delivery.retrieval_completed
    or not v_session.package_served or not v_session.retrieval_completed
    or v_delivery.status not in ('served', 'access_ended_served_unrecalled')
    or v_session.status not in ('completed_opened', 'access_ended_completed_unrecalled')
    or v_completion.export_performed or v_completion.closure_recorded
    or not v_completion.synthetic_only or not v_delivery.synthetic_only
    or not v_session.synthetic_only
    or (v_session.access_state <> 'active' and not exists (
      select 1 from public.claimant_retrieval_access_controls
      where case_id = p_case_id and package_id = p_release_package_id
        and control_state = v_session.access_state and package_was_served
        and retrieval_was_completed and not local_content_recalled
        and not local_content_deleted
    ))
    or (p_exported_at is not null and (p_exported_at < v_completion.opened_at
      or p_exported_at > v_now + interval '1 minute')) then
    raise exception 'Retrieval lifecycle closure does not match completed authority.'
      using errcode = '40001';
  end if;
  insert into public.claimant_retrieval_lifecycle_closures (id, completion_id,
    delivery_id, retrieval_session_id, case_id, release_package_id, claimant_user_id,
    closure_reason, source_case_version, export_performed, export_receipt_digest,
    verified_export_fact_digest, exported_at, closed_at)
  values (p_closure_id, p_completion_id, p_delivery_id, p_retrieval_session_id,
    p_case_id, p_release_package_id, v_case.claimant_user_id, p_closure_reason,
    p_expected_case_version, p_export_performed, p_export_receipt_digest,
    p_verified_export_fact_digest, p_exported_at, v_now);
  insert into public.claimant_retrieval_lifecycle_closure_events (closure_id,
    case_id, claimant_user_id, event_type, idempotency_key, occurred_at)
  values (p_closure_id, p_case_id, v_case.claimant_user_id,
    'retrieval_lifecycle_closed', p_idempotency_key, v_now);
  v_result := jsonb_build_object('closure_id', p_closure_id,
    'completion_id', p_completion_id, 'delivery_id', p_delivery_id,
    'retrieval_session_id', p_retrieval_session_id,
    'case_id', p_case_id, 'release_package_id', p_release_package_id,
    'case_state', v_case.state, 'case_version', v_case.version,
    'closure_recorded', true, 'export_performed', p_export_performed,
    'local_content_recalled', false, 'local_content_deleted', false,
    'historical_delivery_preserved', true, 'historical_completion_preserved', true,
    'closed_at', v_now, 'replayed', false);
  insert into public.claimant_retrieval_lifecycle_closure_idempotency (operation,
    closure_id, case_id, claimant_user_id, idempotency_key, request_digest, result)
  values ('close_retrieval_lifecycle', p_closure_id, p_case_id,
    v_case.claimant_user_id, p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Retrieval lifecycle closure conflicts with existing state.'
    using errcode = '40001';
end
$function$;

revoke all on function public.claimant_close_retrieval_lifecycle(
  uuid, uuid, uuid, uuid, uuid, uuid, integer, text, boolean, text, text,
  timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_close_retrieval_lifecycle(
  uuid, uuid, uuid, uuid, uuid, uuid, integer, text, boolean, text, text,
  timestamptz, uuid
) to service_role;
