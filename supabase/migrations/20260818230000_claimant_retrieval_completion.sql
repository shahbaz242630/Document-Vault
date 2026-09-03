do $drop_completion_checks$
declare v_table regclass; v_column text; v_constraint name;
begin
  for v_table, v_column in values
    ('public.claimant_encrypted_package_deliveries'::regclass, 'retrieval_completed'),
    ('public.claimant_release_retrieval_sessions'::regclass, 'retrieval_completed'),
    ('public.claimant_release_retrieval_sessions'::regclass, 'status')
  loop
    select constraint_row.conname into strict v_constraint
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_attribute attribute_row
      on attribute_row.attrelid = constraint_row.conrelid
      and attribute_row.attnum = constraint_row.conkey[1]
    where constraint_row.conrelid = v_table and constraint_row.contype = 'c'
      and pg_catalog.array_length(constraint_row.conkey, 1) = 1
      and attribute_row.attname = v_column;
    execute format('alter table %s drop constraint %I', v_table, v_constraint);
  end loop;
end $drop_completion_checks$;

alter table public.claimant_release_retrieval_sessions
drop constraint claimant_release_retrieval_sessions_delivery_state_check;
alter table public.claimant_release_retrieval_sessions
add constraint claimant_release_retrieval_sessions_status_check check (
  status in ('authorized_unserved', 'delivery_prepared', 'consumed_served', 'completed_opened')
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
);
alter table public.claimant_encrypted_package_deliveries
add constraint claimant_encrypted_package_deliveries_completion_check check (
  not retrieval_completed or (status = 'served' and package_served)
);

create table public.claimant_retrieval_completions (
  id uuid primary key,
  delivery_id uuid not null unique,
  retrieval_session_id uuid not null unique,
  case_id uuid not null,
  release_package_id uuid not null,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  claimant_key_id uuid not null,
  app_attest_key_id uuid not null,
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{64}$'),
  manifest_digest text not null check (manifest_digest ~ '^[0-9a-f]{64}$'),
  native_open_session_digest text not null check (native_open_session_digest ~ '^[0-9a-f]{64}$'),
  verified_proof_digest text not null check (verified_proof_digest ~ '^[0-9a-f]{64}$'),
  assertion_counter bigint not null check (assertion_counter between 1 and 4294967295),
  asserted_bundle_version text not null check (
    asserted_bundle_version ~ '^[0-9]+(?:\.[0-9]+){0,2}$'
  ),
  asserted_validation_category integer not null check (
    asserted_validation_category in (2, 3, 4)
  ),
  opened_at timestamptz not null,
  completed_at timestamptz not null default now(),
  export_performed boolean not null default false check (not export_performed),
  closure_recorded boolean not null default false check (not closure_recorded),
  synthetic_only boolean not null default true check (synthetic_only),
  unique (id, case_id),
  foreign key (delivery_id, case_id)
    references public.claimant_encrypted_package_deliveries(id, case_id) on delete restrict,
  foreign key (retrieval_session_id, case_id)
    references public.claimant_release_retrieval_sessions(id, case_id) on delete restrict,
  foreign key (release_package_id, case_id)
    references public.claimant_release_packages(id, case_id) on delete restrict,
  foreign key (claimant_key_id, claimant_user_id)
    references public.claimant_device_keys(id, claimant_user_id) on delete restrict,
  foreign key (app_attest_key_id, claimant_user_id)
    references public.claimant_app_attest_keys(id, claimant_user_id) on delete restrict,
  check (completed_at >= opened_at - interval '1 minute')
);

create table public.claimant_retrieval_completion_events (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null,
  case_id uuid not null,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type = 'retrieval_completed_after_verified_open'),
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and metadata = '{}'::jsonb
  ),
  unique (completion_id, event_type),
  unique (case_id, claimant_user_id, idempotency_key, event_type),
  foreign key (completion_id, case_id)
    references public.claimant_retrieval_completions(id, case_id) on delete restrict
);

create table public.claimant_retrieval_completion_idempotency (
  operation text not null check (operation = 'complete_verified_native_open'),
  completion_id uuid not null references public.claimant_retrieval_completions(id)
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
  primary key (operation, completion_id, claimant_user_id, idempotency_key)
);

create index claimant_retrieval_completions_case_claimant_idx
on public.claimant_retrieval_completions (case_id, claimant_user_id);
create index claimant_retrieval_completions_claimant_idx
on public.claimant_retrieval_completions (claimant_user_id);
create index claimant_retrieval_completions_package_case_idx
on public.claimant_retrieval_completions (release_package_id, case_id);
create index claimant_retrieval_completions_claimant_key_idx
on public.claimant_retrieval_completions (claimant_key_id);
create index claimant_retrieval_completions_app_attest_key_idx
on public.claimant_retrieval_completions (app_attest_key_id);
create index claimant_retrieval_completion_events_claimant_idx
on public.claimant_retrieval_completion_events (claimant_user_id, occurred_at desc);
create index claimant_retrieval_completion_idempotency_case_idx
on public.claimant_retrieval_completion_idempotency (case_id);
create index claimant_retrieval_completion_idempotency_completion_idx
on public.claimant_retrieval_completion_idempotency (completion_id);
create index claimant_retrieval_completion_idempotency_claimant_idx
on public.claimant_retrieval_completion_idempotency (claimant_user_id);

revoke all on table public.claimant_retrieval_completions from public;
revoke all on table public.claimant_retrieval_completions from anon;
revoke all on table public.claimant_retrieval_completions from authenticated;
revoke all on table public.claimant_retrieval_completion_events from public;
revoke all on table public.claimant_retrieval_completion_events from anon;
revoke all on table public.claimant_retrieval_completion_events from authenticated;
revoke all on table public.claimant_retrieval_completion_idempotency from public;
revoke all on table public.claimant_retrieval_completion_idempotency from anon;
revoke all on table public.claimant_retrieval_completion_idempotency from authenticated;
grant select, insert on table public.claimant_retrieval_completions to service_role;
grant select, insert on table public.claimant_retrieval_completion_events to service_role;
grant select, insert on table public.claimant_retrieval_completion_idempotency to service_role;

alter table public.claimant_retrieval_completions enable row level security;
alter table public.claimant_retrieval_completions force row level security;
alter table public.claimant_retrieval_completion_events enable row level security;
alter table public.claimant_retrieval_completion_events force row level security;
alter table public.claimant_retrieval_completion_idempotency enable row level security;
alter table public.claimant_retrieval_completion_idempotency force row level security;
create policy "Claimant retrieval completions are server-only."
on public.claimant_retrieval_completions for all to anon, authenticated
using (false) with check (false);
create policy "Claimant retrieval completion events are server-only."
on public.claimant_retrieval_completion_events for all to anon, authenticated
using (false) with check (false);
create policy "Claimant retrieval completion idempotency is server-only."
on public.claimant_retrieval_completion_idempotency for all to anon, authenticated
using (false) with check (false);

create function public.claimant_complete_verified_native_open(
  p_completion_id uuid,
  p_delivery_id uuid,
  p_delivery_key text,
  p_retrieval_session_id uuid,
  p_case_id uuid,
  p_release_package_id uuid,
  p_portal_session_id uuid,
  p_claimant_key_id uuid,
  p_app_attest_key_id_digest text,
  p_expected_previous_counter bigint,
  p_verified_counter bigint,
  p_bundle_version text,
  p_validation_category integer,
  p_payload_digest text,
  p_manifest_digest text,
  p_native_open_session_digest text,
  p_opened_at timestamptz,
  p_verified_proof_digest text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz := now();
  v_delivery public.claimant_encrypted_package_deliveries%rowtype;
  v_session public.claimant_release_retrieval_sessions%rowtype;
  v_case public.claimant_cases%rowtype;
  v_portal public.claimant_portal_session_controls%rowtype;
  v_manifest public.claimant_release_signed_manifests%rowtype;
  v_app_key public.claimant_app_attest_keys%rowtype;
  v_existing public.claimant_retrieval_completion_idempotency%rowtype;
  v_expected_proof_digest text;
  v_request_digest text;
  v_result jsonb;
begin
  if p_delivery_key !~ '^synthetic_package_delivery_[a-z0-9_]{1,100}$'
    or p_payload_digest !~ '^[0-9a-f]{64}$'
    or p_manifest_digest !~ '^[0-9a-f]{64}$'
    or p_native_open_session_digest !~ '^[0-9a-f]{64}$'
    or p_verified_proof_digest !~ '^[0-9a-f]{64}$'
    or p_bundle_version !~ '^[0-9]+(?:\.[0-9]+){0,2}$'
    or p_validation_category not in (2, 3, 4) then
    raise exception 'Verified native-open completion input is invalid.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:retrieval-completion:' || p_delivery_id::text, 0));
  select * into v_delivery from public.claimant_encrypted_package_deliveries
  where id = p_delivery_id and case_id = p_case_id for update;
  select * into v_session from public.claimant_release_retrieval_sessions
  where id = p_retrieval_session_id and case_id = p_case_id for update;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  if v_delivery.id is null or v_session.id is null or v_case.id is null then
    raise exception 'Verified native-open authority is unavailable.' using errcode = '40001';
  end if;
  select * into v_portal from public.claimant_portal_session_controls
  where user_id = v_delivery.claimant_user_id for update;
  select * into v_manifest from public.claimant_release_signed_manifests
  where finalization_id = v_delivery.finalization_id
    and package_id = v_delivery.package_id and case_id = p_case_id
    and grant_id = v_delivery.grant_id;
  select * into v_app_key from public.claimant_app_attest_keys
  where claimant_user_id = v_delivery.claimant_user_id
    and app_attest_key_id_digest = p_app_attest_key_id_digest for update;
  v_expected_proof_digest := encode(extensions.digest(concat_ws('|',
    'sanduqkin:claim:native-open-proof:v1', p_completion_id::text,
    p_delivery_id::text, p_delivery_key, p_retrieval_session_id::text,
    p_case_id::text, p_release_package_id::text, p_portal_session_id::text,
    p_claimant_key_id::text, p_app_attest_key_id_digest,
    p_expected_previous_counter::text, p_verified_counter::text,
    p_bundle_version, p_validation_category::text, p_payload_digest,
    p_manifest_digest, p_native_open_session_digest,
    to_char(p_opened_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'false'), 'sha256'), 'hex');
  v_request_digest := encode(extensions.digest(concat_ws('|',
    v_expected_proof_digest, p_idempotency_key::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_retrieval_completion_idempotency
  where operation = 'complete_verified_native_open'
    and completion_id = p_completion_id
    and claimant_user_id = v_delivery.claimant_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key input changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  if p_verified_proof_digest <> v_expected_proof_digest
    or v_delivery.delivery_key <> p_delivery_key
    or v_delivery.retrieval_session_id <> p_retrieval_session_id
    or v_delivery.package_id <> p_release_package_id
    or v_delivery.payload_digest <> p_payload_digest
    or v_delivery.status <> 'served' or not v_delivery.package_served
    or v_delivery.retrieval_completed
    or v_session.status <> 'consumed_served' or not v_session.package_served
    or v_session.retrieval_completed or v_session.portal_session_id <> p_portal_session_id
    or v_session.recipient_key_id <> p_claimant_key_id
    or v_case.claimant_user_id <> v_delivery.claimant_user_id
    or v_case.state <> 'released'
    or v_case.version <> v_delivery.source_case_version + 1
    or v_portal.user_id is null or v_portal.status <> 'active'
    or v_portal.active_session_id <> p_portal_session_id
    or v_portal.version <> v_session.portal_session_version
    or v_portal.assurance_level <> 'aal2'
    or not exists (select 1 from public.claimant_identities identity
      where identity.user_id = v_delivery.claimant_user_id and identity.status = 'active')
    or not exists (select 1 from public.claimant_portal_eligibilities eligibility
      where eligibility.user_id = v_delivery.claimant_user_id
        and eligibility.status = 'eligible' and eligibility.source = 'synthetic_fixture')
    or v_manifest.id is null or v_manifest.manifest_digest <> p_manifest_digest
    or not v_manifest.synthetic_only
    or not exists (select 1 from public.claimant_device_keys device_key
      join public.claimant_case_device_keys case_key
        on case_key.key_id = device_key.id
        and case_key.claimant_user_id = device_key.claimant_user_id
      where device_key.id = p_claimant_key_id
        and device_key.claimant_user_id = v_delivery.claimant_user_id
        and device_key.status = 'active'
        and device_key.key_version = v_session.recipient_key_version
        and case_key.case_id = p_case_id and case_key.status = 'active')
    or v_app_key.id is null or v_app_key.status <> 'active'
    or v_app_key.assertion_counter <> p_expected_previous_counter
    or p_verified_counter <= v_app_key.assertion_counter
    or p_opened_at < v_delivery.served_at - interval '1 second'
    or p_opened_at > v_now + interval '1 minute'
    or p_opened_at > v_session.expires_at
    or p_opened_at > (select expires_at
      from public.claimant_release_package_finalizations
      where id = v_delivery.finalization_id) then
    raise exception 'Verified native-open proof does not match current authority.'
      using errcode = '40001';
  end if;
  update public.claimant_app_attest_keys set assertion_counter = p_verified_counter,
    last_asserted_bundle_version = p_bundle_version,
    last_asserted_validation_category = p_validation_category,
    last_asserted_at = v_now, updated_at = v_now
  where id = v_app_key.id and assertion_counter = p_expected_previous_counter;
  if not found then
    raise exception 'App Attest assertion counter changed.' using errcode = '40001';
  end if;
  insert into public.claimant_app_attest_events (event_type, claimant_user_id,
    app_attest_key_id, claimant_key_id, idempotency_key, assertion_counter,
    occurred_at, metadata) values ('app_attest_assertion_verified',
    v_delivery.claimant_user_id, v_app_key.id, p_claimant_key_id, p_idempotency_key,
    p_verified_counter, v_now,
    jsonb_build_object('bundle_version', p_bundle_version,
      'validation_category', p_validation_category));
  insert into public.claimant_retrieval_completions (id, delivery_id,
    retrieval_session_id, case_id, release_package_id, claimant_user_id,
    claimant_key_id, app_attest_key_id, payload_digest, manifest_digest,
    native_open_session_digest, verified_proof_digest, assertion_counter,
    asserted_bundle_version, asserted_validation_category, opened_at, completed_at)
  values (p_completion_id, p_delivery_id, p_retrieval_session_id, p_case_id,
    p_release_package_id, v_delivery.claimant_user_id, p_claimant_key_id,
    v_app_key.id, p_payload_digest, p_manifest_digest, p_native_open_session_digest,
    p_verified_proof_digest, p_verified_counter, p_bundle_version,
    p_validation_category, p_opened_at, v_now);
  update public.claimant_encrypted_package_deliveries set retrieval_completed = true
  where id = p_delivery_id and not retrieval_completed;
  update public.claimant_release_retrieval_sessions set
    status = 'completed_opened', retrieval_completed = true
  where id = p_retrieval_session_id and status = 'consumed_served'
    and not retrieval_completed;
  insert into public.claimant_retrieval_completion_events (completion_id, case_id,
    claimant_user_id, event_type, idempotency_key, occurred_at)
  values (p_completion_id, p_case_id, v_delivery.claimant_user_id,
    'retrieval_completed_after_verified_open', p_idempotency_key, v_now);
  v_result := jsonb_build_object('completion_id', p_completion_id,
    'delivery_id', p_delivery_id, 'retrieval_session_id', p_retrieval_session_id,
    'case_id', p_case_id, 'case_state', 'released',
    'case_version', v_delivery.source_case_version + 1,
    'release_package_id', p_release_package_id, 'package_served', true,
    'retrieval_completed', true, 'export_performed', false,
    'closure_recorded', false, 'completed_at', v_now, 'replayed', false);
  insert into public.claimant_retrieval_completion_idempotency (operation,
    completion_id, case_id, claimant_user_id, idempotency_key, request_digest, result)
  values ('complete_verified_native_open', p_completion_id, p_case_id,
    v_delivery.claimant_user_id, p_idempotency_key, v_request_digest,
    v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Verified native-open completion conflicts with existing state.'
    using errcode = '40001';
end
$function$;

revoke all on function public.claimant_complete_verified_native_open(
  uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, text, bigint, bigint,
  text, integer, text, text, text, timestamptz, text, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_complete_verified_native_open(
  uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, text, bigint, bigint,
  text, integer, text, text, text, timestamptz, text, uuid
) to service_role;
