alter table public.claimant_idempotency_records
drop constraint claimant_idempotency_records_operation_check;

alter table public.claimant_idempotency_records
add constraint claimant_idempotency_records_operation_check check (
  operation in (
    'issue_registered_invitation', 'accept_registered_invitation',
    'activate_claimant_session', 'revoke_claimant_session',
    'activate_claimant_portal_session', 'revoke_claimant_portal_session',
    'revoke_registered_invitation', 'lifecycle_enroll', 'lifecycle_replace',
    'lifecycle_revoke', 'lifecycle_finalize',
    'register_claimant_app_attest_key', 'advance_claimant_app_attest_assertion'
  )
);

create table public.claimant_app_attest_keys (
  id uuid primary key default gen_random_uuid(),
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  app_attest_key_id_digest text not null unique check (
    app_attest_key_id_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
  ),
  app_id_hash text not null check (app_id_hash ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  public_key_spki_base64 text not null check (
    length(public_key_spki_base64) between 80 and 512
    and public_key_spki_base64 ~ '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
  ),
  attestation_receipt bytea not null check (octet_length(attestation_receipt) between 1 and 32768),
  environment text not null check (environment in ('development', 'production')),
  attested_bundle_version text not null check (attested_bundle_version ~ '^[0-9]+(?:\.[0-9]+){0,2}$'),
  attested_validation_category integer not null check (attested_validation_category in (2, 3, 4)),
  assertion_counter bigint not null default 0 check (assertion_counter between 0 and 4294967295),
  last_asserted_bundle_version text null check (
    last_asserted_bundle_version is null or last_asserted_bundle_version ~ '^[0-9]+(?:\.[0-9]+){0,2}$'
  ),
  last_asserted_validation_category integer null check (
    last_asserted_validation_category is null or last_asserted_validation_category in (2, 3, 4)
  ),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_asserted_at timestamptz null,
  revoked_at timestamptz null,
  check (updated_at >= created_at),
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null)),
  unique (id, claimant_user_id)
);

create index claimant_app_attest_keys_user_status_idx
on public.claimant_app_attest_keys (claimant_user_id, status, created_at desc);

create table public.claimant_app_attest_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('app_attest_key_registered', 'app_attest_assertion_verified')),
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  app_attest_key_id uuid not null,
  claimant_key_id uuid null,
  idempotency_key uuid not null,
  assertion_counter bigint not null check (assertion_counter between 0 and 4294967295),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and not (metadata ?| array['receipt', 'public_key', 'attestation', 'assertion', 'challenge', 'token', 'email', 'address'])
  ),
  foreign key (app_attest_key_id, claimant_user_id)
    references public.claimant_app_attest_keys(id, claimant_user_id) on delete restrict,
  foreign key (claimant_key_id, claimant_user_id)
    references public.claimant_device_keys(id, claimant_user_id) on delete restrict,
  unique (claimant_user_id, idempotency_key, event_type)
);

revoke all on table public.claimant_app_attest_keys from public;
revoke all on table public.claimant_app_attest_keys from anon;
revoke all on table public.claimant_app_attest_keys from authenticated;
revoke all on table public.claimant_app_attest_events from public;
revoke all on table public.claimant_app_attest_events from anon;
revoke all on table public.claimant_app_attest_events from authenticated;
grant select, insert, update on table public.claimant_app_attest_keys to service_role;
grant select, insert on table public.claimant_app_attest_events to service_role;

alter table public.claimant_app_attest_keys enable row level security;
alter table public.claimant_app_attest_keys force row level security;
alter table public.claimant_app_attest_events enable row level security;
alter table public.claimant_app_attest_events force row level security;

create policy "Claimant App Attest keys are server-only."
on public.claimant_app_attest_keys for all to anon, authenticated using (false) with check (false);
create policy "Claimant App Attest events are server-only."
on public.claimant_app_attest_events for all to anon, authenticated using (false) with check (false);

create function public.claimant_register_app_attest_key(
  p_claimant_user_id uuid,
  p_portal_session_id uuid,
  p_app_attest_key_id_digest text,
  p_app_id_hash text,
  p_public_key_spki_base64 text,
  p_attestation_receipt_base64 text,
  p_environment text,
  p_bundle_version text,
  p_validation_category integer,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_existing public.claimant_idempotency_records%rowtype;
  v_key public.claimant_app_attest_keys%rowtype;
  v_receipt bytea;
  v_digest text;
  v_result jsonb;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  perform pg_advisory_xact_lock(hashtextextended('claimant:app-attest-key:' || p_app_attest_key_id_digest, 0));
  begin
    v_receipt := decode(p_attestation_receipt_base64, 'base64');
  exception when others then
    raise exception 'Verified App Attest registration input is invalid.' using errcode = '22023';
  end;
  v_digest := encode(extensions.digest(concat_ws(
    '|', p_claimant_user_id::text, p_portal_session_id::text, p_app_attest_key_id_digest,
    p_app_id_hash, p_public_key_spki_base64, encode(extensions.digest(v_receipt, 'sha256'), 'hex'),
    p_environment, p_bundle_version, p_validation_category::text
  ), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
  where operation = 'register_claimant_app_attest_key'
    and actor_user_id = p_claimant_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Idempotency key input changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  insert into public.claimant_app_attest_keys (
    claimant_user_id, app_attest_key_id_digest, app_id_hash, public_key_spki_base64,
    attestation_receipt, environment, attested_bundle_version, attested_validation_category
  ) values (
    p_claimant_user_id, p_app_attest_key_id_digest, p_app_id_hash, p_public_key_spki_base64,
    v_receipt, p_environment, p_bundle_version, p_validation_category
  ) returning * into v_key;
  insert into public.claimant_app_attest_events (
    event_type, claimant_user_id, app_attest_key_id, idempotency_key, assertion_counter,
    metadata
  ) values (
    'app_attest_key_registered', p_claimant_user_id, v_key.id, p_idempotency_key, 0,
    jsonb_build_object('environment', v_key.environment, 'bundle_version', v_key.attested_bundle_version,
      'validation_category', v_key.attested_validation_category)
  );
  v_result := jsonb_build_object('app_attest_key_record_id', v_key.id, 'assertion_counter', 0, 'replayed', false);
  insert into public.claimant_idempotency_records (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('register_claimant_app_attest_key', p_claimant_user_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end
$function$;

create function public.claimant_advance_app_attest_assertion(
  p_claimant_user_id uuid,
  p_portal_session_id uuid,
  p_claimant_key_id uuid,
  p_app_attest_key_id_digest text,
  p_expected_previous_counter bigint,
  p_verified_counter bigint,
  p_bundle_version text,
  p_validation_category integer,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_existing public.claimant_idempotency_records%rowtype;
  v_key public.claimant_app_attest_keys%rowtype;
  v_digest text;
  v_result jsonb;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  if not exists (
    select 1 from public.claimant_device_keys where id = p_claimant_key_id
      and claimant_user_id = p_claimant_user_id and status = 'active'
  ) then
    raise exception 'Claimant key is unavailable.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('claimant:app-attest-key:' || p_app_attest_key_id_digest, 0));
  v_digest := encode(extensions.digest(concat_ws(
    '|', p_claimant_user_id::text, p_portal_session_id::text, p_claimant_key_id::text,
    p_app_attest_key_id_digest, p_expected_previous_counter::text, p_verified_counter::text,
    p_bundle_version, p_validation_category::text
  ), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
  where operation = 'advance_claimant_app_attest_assertion'
    and actor_user_id = p_claimant_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Idempotency key input changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_key from public.claimant_app_attest_keys
  where claimant_user_id = p_claimant_user_id and app_attest_key_id_digest = p_app_attest_key_id_digest
  for update;
  if not found or v_key.status <> 'active' then
    raise exception 'App Attest key is unavailable.' using errcode = '42501';
  end if;
  if v_key.assertion_counter <> p_expected_previous_counter or p_verified_counter <= v_key.assertion_counter then
    raise exception 'App Attest assertion counter is stale.' using errcode = '40001';
  end if;
  update public.claimant_app_attest_keys set
    assertion_counter = p_verified_counter, last_asserted_bundle_version = p_bundle_version,
    last_asserted_validation_category = p_validation_category, last_asserted_at = now(), updated_at = now()
  where id = v_key.id returning * into v_key;
  insert into public.claimant_app_attest_events (
    event_type, claimant_user_id, app_attest_key_id, claimant_key_id, idempotency_key,
    assertion_counter, metadata
  ) values (
    'app_attest_assertion_verified', p_claimant_user_id, v_key.id, p_claimant_key_id,
    p_idempotency_key, p_verified_counter,
    jsonb_build_object('bundle_version', p_bundle_version, 'validation_category', p_validation_category)
  );
  v_result := jsonb_build_object('app_attest_key_record_id', v_key.id,
    'assertion_counter', v_key.assertion_counter, 'replayed', false);
  insert into public.claimant_idempotency_records (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('advance_claimant_app_attest_assertion', p_claimant_user_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end
$function$;

revoke all on function public.claimant_register_app_attest_key(uuid, uuid, text, text, text, text, text, text, integer, uuid)
from public, anon, authenticated;
revoke all on function public.claimant_advance_app_attest_assertion(uuid, uuid, uuid, text, bigint, bigint, text, integer, uuid)
from public, anon, authenticated;
grant execute on function public.claimant_register_app_attest_key(uuid, uuid, text, text, text, text, text, text, integer, uuid)
to service_role;
grant execute on function public.claimant_advance_app_attest_assertion(uuid, uuid, uuid, text, bigint, bigint, text, integer, uuid)
to service_role;
