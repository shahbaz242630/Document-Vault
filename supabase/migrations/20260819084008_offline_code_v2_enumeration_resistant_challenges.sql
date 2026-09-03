alter table public.claimant_offline_code_v2_locators
add column kdf_salt text null
check (kdf_salt is null or kdf_salt ~ '^[A-Za-z0-9_-]{21}[AQgw]$');

create table public.claimant_offline_code_v2_rate_limits (
  scope_type text not null check (scope_type in ('global', 'network', 'device', 'locator')),
  scope_digest text not null check (scope_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  window_started_at timestamptz not null,
  window_seconds integer not null check (window_seconds in (60, 300)),
  request_count integer not null check (request_count between 1 and 1000000),
  expires_at timestamptz not null,
  primary key (scope_type, scope_digest, window_started_at),
  check (expires_at = window_started_at + make_interval(secs => window_seconds))
);

create index claimant_offline_code_v2_rate_limit_expiry_idx
on public.claimant_offline_code_v2_rate_limits (expires_at);

revoke all on table public.claimant_offline_code_v2_rate_limits from public;
revoke all on table public.claimant_offline_code_v2_rate_limits from anon;
revoke all on table public.claimant_offline_code_v2_rate_limits from authenticated;
grant select, insert, update, delete on table public.claimant_offline_code_v2_rate_limits to service_role;
alter table public.claimant_offline_code_v2_rate_limits enable row level security;
alter table public.claimant_offline_code_v2_rate_limits force row level security;
create policy "Offline-code V2 rate limits are server-only."
on public.claimant_offline_code_v2_rate_limits for all to anon, authenticated
using (false) with check (false);

drop function public.claimant_register_offline_code_v2_locator(
  uuid, uuid, text, text, uuid, text, text, text, text, text, timestamptz, timestamptz, uuid
);
drop function public.claimant_issue_offline_code_v2_challenge(
  text, uuid, text, text, text, text, text, text, text, timestamptz, timestamptz, uuid
);

create function public.claimant_register_offline_code_v2_locator(
  p_locator_record_id uuid, p_owner_user_id uuid, p_locator_index_digest text,
  p_locator_commitment text, p_grant_id uuid, p_proof_public_key text,
  p_record_binding_digest text, p_kdf_salt text, p_wrap_nonce text, p_wrap_ciphertext text,
  p_wrap_associated_data_digest text, p_issued_at timestamptz, p_expires_at timestamptz,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_existing public.claimant_offline_code_v2_idempotency%rowtype;
  v_digest text; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:offline-v2:register:' || p_owner_user_id::text || ':' || p_grant_id::text, 0));
  if p_locator_index_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_locator_commitment !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_proof_public_key !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_record_binding_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_kdf_salt !~ '^[A-Za-z0-9_-]{21}[AQgw]$'
    or p_wrap_nonce !~ '^[A-Za-z0-9_-]{32}$'
    or p_wrap_ciphertext !~ '^[A-Za-z0-9_-]{64}$'
    or p_wrap_associated_data_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_issued_at < now() - interval '1 minute' or p_issued_at > now() + interval '1 minute'
    or p_expires_at <= p_issued_at or p_expires_at > p_issued_at + interval '365 days' then
    raise exception 'Offline-code V2 locator input is invalid.' using errcode = '22023';
  end if;
  v_digest := encode(extensions.digest(concat_ws('|', p_locator_record_id::text,
    p_owner_user_id::text, p_locator_index_digest, p_locator_commitment, p_grant_id::text,
    p_proof_public_key, p_record_binding_digest, p_kdf_salt, p_wrap_nonce,
    encode(extensions.digest(p_wrap_ciphertext, 'sha256'), 'hex'),
    p_wrap_associated_data_digest, p_issued_at::text, p_expires_at::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_offline_code_v2_idempotency
  where operation = 'register_locator' and scope_id = p_locator_record_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Offline-code V2 registration idempotency changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  begin
    insert into public.claimant_offline_code_v2_locators (
      id, owner_user_id, locator_index_digest, locator_commitment, grant_id,
      proof_public_key, record_binding_digest, kdf_salt, wrap_nonce, wrap_ciphertext,
      wrap_associated_data_digest, issued_at, expires_at
    ) values (p_locator_record_id, p_owner_user_id, p_locator_index_digest,
      p_locator_commitment, p_grant_id, p_proof_public_key, p_record_binding_digest,
      p_kdf_salt, p_wrap_nonce, p_wrap_ciphertext, p_wrap_associated_data_digest,
      p_issued_at, p_expires_at);
  exception when foreign_key_violation then
    raise exception 'Offline-code V2 registration authority is unavailable.' using errcode = '42501';
  end;
  insert into public.claimant_offline_code_v2_events
    (locator_record_id, event_type, idempotency_key, metadata)
  values (p_locator_record_id, 'locator_registered', p_idempotency_key,
    jsonb_build_object('locator_version', 2, 'proof_key_version', 1,
      'kdf_profile_id', 'argon2id-synthetic-test-v2', 'synthetic_only', true));
  v_result := jsonb_build_object('locator_record_id', p_locator_record_id,
    'locator_version', 2, 'status', 'active', 'authority', 'route_possession_only',
    'synthetic_only', true, 'claim_created', false, 'release_authorized', false,
    'replayed', false);
  insert into public.claimant_offline_code_v2_idempotency
    (operation, scope_id, idempotency_key, request_digest, result)
  values ('register_locator', p_locator_record_id, p_idempotency_key,
    v_digest, v_result - 'replayed');
  return v_result;
end $function$;

create function public.claimant_issue_offline_code_v2_challenge(
  p_locator_index_digest text, p_network_bucket_digest text,
  p_device_bucket_digest text, p_global_bucket_digest text,
  p_origin text, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_locator public.claimant_offline_code_v2_locators%rowtype;
  v_existing public.claimant_offline_code_v2_idempotency%rowtype;
  v_limit record; v_window timestamptz; v_count integer; v_rate_limited boolean := false;
  v_scope_id uuid; v_request_digest text; v_result jsonb; v_available boolean;
  v_challenge_id uuid; v_locator_record_id uuid; v_locator_commitment text;
  v_proof_public_key text; v_record_binding_digest text; v_kdf_salt text; v_nonce text;
  v_issued_at timestamptz; v_expires_at timestamptz; v_issued_text text; v_expires_text text;
  v_challenge_text text; v_challenge_bytes text; v_challenge_digest text;
begin
  if p_locator_index_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_network_bucket_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or (p_device_bucket_digest is not null
      and p_device_bucket_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$')
    or p_global_bucket_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_origin !~ '^https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?$' then
    raise exception 'Offline-code V2 challenge request is invalid.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:offline-v2:locator:' || p_locator_index_digest, 0));
  v_scope_id := (substring(encode(extensions.digest(
    'claimant:offline-v2:scope:' || p_locator_index_digest, 'sha256'), 'hex'), 1, 8) || '-'
    || substring(encode(extensions.digest('claimant:offline-v2:scope:' || p_locator_index_digest,
      'sha256'), 'hex'), 9, 4) || '-4'
    || substring(encode(extensions.digest('claimant:offline-v2:scope:' || p_locator_index_digest,
      'sha256'), 'hex'), 14, 3) || '-8'
    || substring(encode(extensions.digest('claimant:offline-v2:scope:' || p_locator_index_digest,
      'sha256'), 'hex'), 18, 3) || '-'
    || substring(encode(extensions.digest('claimant:offline-v2:scope:' || p_locator_index_digest,
      'sha256'), 'hex'), 21, 12))::uuid;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_locator_index_digest,
    p_origin), 'sha256'), 'hex');
  select * into v_existing from public.claimant_offline_code_v2_idempotency
  where operation = 'issue_challenge' and scope_id = v_scope_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Offline-code V2 challenge idempotency changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  delete from public.claimant_offline_code_v2_rate_limits where expires_at <= now();
  for v_limit in select * from (values
    ('global', p_global_bucket_digest, 60, 1000),
    ('network', p_network_bucket_digest, 300, 20),
    ('locator', p_locator_index_digest, 300, 5),
    ('device', p_device_bucket_digest, 300, 10)
  ) as limits(scope_type, scope_digest, window_seconds, maximum)
  where scope_digest is not null loop
    v_window := to_timestamp(floor(extract(epoch from clock_timestamp())
      / v_limit.window_seconds) * v_limit.window_seconds);
    insert into public.claimant_offline_code_v2_rate_limits as stored_limit
      (scope_type, scope_digest, window_started_at, window_seconds, request_count, expires_at)
    values (v_limit.scope_type, v_limit.scope_digest, v_window, v_limit.window_seconds,
      1, v_window + make_interval(secs => v_limit.window_seconds))
    on conflict (scope_type, scope_digest, window_started_at) do update
      set request_count = least(stored_limit.request_count + 1, 1000000)
    returning request_count into v_count;
    if v_count > v_limit.maximum then v_rate_limited := true; end if;
  end loop;
  if v_rate_limited then
    return jsonb_build_object('rate_limited', true, 'retry_after_seconds', 300,
      'identity_verified', false, 'claim_created', false, 'release_authorized', false,
      'replayed', false);
  end if;
  update public.claimant_offline_code_v2_locators set status = 'expired',
    revoked_at = now(), terminal_reason = 'expired', updated_at = now()
  where locator_index_digest = p_locator_index_digest and status = 'active' and expires_at <= now();
  update public.claimant_offline_code_v2_challenges set status = 'expired', terminal_at = now()
  where status = 'issued' and expires_at <= now();
  select * into v_locator from public.claimant_offline_code_v2_locators
  where locator_index_digest = p_locator_index_digest for update;
  v_available := v_locator.id is not null and v_locator.status = 'active'
    and v_locator.expires_at > now() and v_locator.kdf_salt is not null
    and (v_locator.locked_until is null or v_locator.locked_until <= now());
  v_challenge_id := gen_random_uuid();
  v_locator_record_id := case when v_available then v_locator.id else gen_random_uuid() end;
  v_locator_commitment := case when v_available then v_locator.locator_commitment else
    rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=') end;
  v_proof_public_key := case when v_available then v_locator.proof_public_key else
    rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=') end;
  v_record_binding_digest := case when v_available then v_locator.record_binding_digest else
    rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=') end;
  v_kdf_salt := case when v_available then v_locator.kdf_salt else
    rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=') end;
  v_nonce := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_issued_at := date_trunc('milliseconds', clock_timestamp());
  v_expires_at := v_issued_at + interval '5 minutes';
  v_issued_text := to_char(v_issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_expires_text := to_char(v_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_challenge_text := concat('{"authority":"route_possession_only","challenge_id":',
    to_jsonb(v_challenge_id::text)::text, ',"expires_at":', to_jsonb(v_expires_text)::text,
    ',"issued_at":', to_jsonb(v_issued_text)::text, ',"locator_commitment":',
    to_jsonb(v_locator_commitment)::text, ',"locator_record_id":',
    to_jsonb(v_locator_record_id::text)::text, ',"locator_version":2,"nonce":',
    to_jsonb(v_nonce)::text, ',"origin":', to_jsonb(p_origin)::text,
    ',"proof_key_version":1,"proof_public_key":', to_jsonb(v_proof_public_key)::text,
    ',"protocol":"sanduqkin:claim:offline-code:v2","purpose":"possession_challenge",',
    '"record_binding_digest":', to_jsonb(v_record_binding_digest)::text, '}');
  v_challenge_bytes := rtrim(translate(replace(encode(convert_to(v_challenge_text, 'UTF8'),
    'base64'), E'\n', ''), '+/', '-_'), '=');
  v_challenge_digest := rtrim(translate(encode(extensions.digest(v_challenge_text,
    'sha256'), 'base64'), '+/', '-_'), '=');
  if v_available then
    update public.claimant_offline_code_v2_challenges set status = 'expired', terminal_at = now()
    where locator_record_id = v_locator.id and status = 'issued';
    insert into public.claimant_offline_code_v2_challenges (
      id, locator_record_id, locator_version, locator_commitment, proof_key_version,
      proof_public_key, record_binding_digest, challenge_bytes_base64url,
      challenge_bytes_digest, origin, nonce, issued_at, expires_at
    ) values (v_challenge_id, v_locator.id, 2, v_locator_commitment, 1,
      v_proof_public_key, v_record_binding_digest, v_challenge_bytes,
      v_challenge_digest, p_origin, v_nonce, v_issued_at, v_expires_at);
    insert into public.claimant_offline_code_v2_events
      (locator_record_id, challenge_id, event_type, idempotency_key, metadata)
    values (v_locator.id, v_challenge_id, 'challenge_issued', p_idempotency_key,
      jsonb_build_object('locator_version', 2, 'proof_key_version', 1));
  end if;
  v_result := jsonb_build_object('rate_limited', false,
    'challenge', jsonb_build_object('authority', 'route_possession_only',
      'challenge_id', v_challenge_id, 'expires_at', v_expires_text,
      'issued_at', v_issued_text, 'locator_commitment', v_locator_commitment,
      'locator_record_id', v_locator_record_id, 'locator_version', 2, 'nonce', v_nonce,
      'origin', p_origin, 'proof_key_version', 1, 'proof_public_key', v_proof_public_key,
      'protocol', 'sanduqkin:claim:offline-code:v2', 'purpose', 'possession_challenge',
      'record_binding_digest', v_record_binding_digest),
    'challenge_bytes_base64url', v_challenge_bytes,
    'challenge_bytes_digest', v_challenge_digest,
    'kdf_profile', jsonb_build_object('algorithm', 'argon2id',
      'memlimit_bytes', 67108864, 'opslimit', 2, 'output_bytes', 32,
      'production_approved', false, 'profile_id', 'argon2id-synthetic-test-v2',
      'protocol', 'sanduqkin:claim:offline-code:v2', 'purpose', 'client_secret_root',
      'salt', v_kdf_salt),
    'identity_verified', false, 'claim_created', false, 'release_authorized', false,
    'replayed', false);
  insert into public.claimant_offline_code_v2_idempotency
    (operation, scope_id, idempotency_key, request_digest, result)
  values ('issue_challenge', v_scope_id, p_idempotency_key,
    v_request_digest, v_result - 'replayed');
  return v_result;
end $function$;

revoke all on function public.claimant_register_offline_code_v2_locator(
  uuid, uuid, text, text, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, uuid
) from public, anon, authenticated;
revoke all on function public.claimant_issue_offline_code_v2_challenge(
  text, text, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_register_offline_code_v2_locator(
  uuid, uuid, text, text, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, uuid
) to service_role;
grant execute on function public.claimant_issue_offline_code_v2_challenge(
  text, text, text, text, text, uuid
) to service_role;
