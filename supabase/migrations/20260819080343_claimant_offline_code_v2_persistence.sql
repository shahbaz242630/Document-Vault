create table public.claimant_offline_code_v2_locators (
  id uuid primary key,
  protocol text not null default 'sanduqkin:claim:offline-code:v2'
    check (protocol = 'sanduqkin:claim:offline-code:v2'),
  authority text not null default 'route_possession_only'
    check (authority = 'route_possession_only'),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  locator_index_digest text not null unique
    check (locator_index_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  locator_version integer not null default 2 check (locator_version = 2),
  locator_commitment text not null
    check (locator_commitment ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  grant_id uuid not null unique,
  proof_key_version integer not null default 1 check (proof_key_version = 1),
  proof_public_key text not null
    check (proof_public_key ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  kdf_profile_id text not null default 'argon2id-synthetic-test-v2'
    check (kdf_profile_id = 'argon2id-synthetic-test-v2'),
  record_binding_digest text not null
    check (record_binding_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  wrap_nonce text not null check (wrap_nonce ~ '^[A-Za-z0-9_-]{32}$'),
  wrap_ciphertext text not null check (wrap_ciphertext ~ '^[A-Za-z0-9_-]{64}$'),
  wrap_associated_data_digest text not null
    check (wrap_associated_data_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  terminal_reason text null check (terminal_reason is null or terminal_reason in ('owner_revoked', 'expired')),
  failure_window_started_at timestamptz null,
  failed_attempt_count integer not null default 0 check (failed_attempt_count between 0 and 5),
  locked_until timestamptz null,
  synthetic_only boolean not null default true check (synthetic_only = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, locator_version),
  check (expires_at > issued_at and expires_at <= issued_at + interval '365 days'),
  check ((status = 'active' and revoked_at is null and terminal_reason is null)
    or (status in ('revoked', 'expired') and revoked_at is not null and terminal_reason is not null)),
  check ((failed_attempt_count = 0 and failure_window_started_at is null)
    or (failed_attempt_count > 0 and failure_window_started_at is not null)),
  check (locked_until is null or failed_attempt_count = 5)
);

create index claimant_offline_code_v2_locator_expiry_idx
on public.claimant_offline_code_v2_locators (status, expires_at);
create index claimant_offline_code_v2_locator_lock_idx
on public.claimant_offline_code_v2_locators (locked_until)
where status = 'active' and locked_until is not null;

create table public.claimant_offline_code_v2_challenges (
  id uuid primary key,
  locator_record_id uuid not null,
  locator_version integer not null check (locator_version = 2),
  locator_commitment text not null
    check (locator_commitment ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  proof_key_version integer not null check (proof_key_version = 1),
  proof_public_key text not null
    check (proof_public_key ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  record_binding_digest text not null
    check (record_binding_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  challenge_bytes_base64url text not null
    check (length(challenge_bytes_base64url) between 64 and 8192
      and challenge_bytes_base64url ~ '^[A-Za-z0-9_-]+$'),
  challenge_bytes_digest text not null
    check (challenge_bytes_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  origin text not null
    check (origin ~ '^https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?$'),
  nonce text not null check (nonce ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  status text not null default 'issued'
    check (status in ('issued', 'verified', 'failed', 'expired', 'revoked')),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  terminal_at timestamptz null,
  created_at timestamptz not null default now(),
  foreign key (locator_record_id, locator_version)
    references public.claimant_offline_code_v2_locators(id, locator_version) on delete restrict,
  check (expires_at = issued_at + interval '5 minutes'),
  check ((status = 'issued' and terminal_at is null)
    or (status <> 'issued' and terminal_at is not null))
);

create unique index claimant_offline_code_v2_one_open_challenge_idx
on public.claimant_offline_code_v2_challenges (locator_record_id)
where status = 'issued';
create index claimant_offline_code_v2_challenge_expiry_idx
on public.claimant_offline_code_v2_challenges (status, expires_at);

create table public.claimant_offline_code_v2_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.claimant_offline_code_v2_challenges(id) on delete restrict,
  locator_record_id uuid not null references public.claimant_offline_code_v2_locators(id) on delete restrict,
  attempt_number integer not null check (attempt_number between 1 and 5),
  proof_signature_digest text not null
    check (proof_signature_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  verification_outcome text not null check (verification_outcome in ('invalid', 'verified')),
  occurred_at timestamptz not null default now(),
  unique (challenge_id, attempt_number),
  unique (challenge_id, proof_signature_digest)
);

create index claimant_offline_code_v2_attempt_locator_idx
on public.claimant_offline_code_v2_attempts (locator_record_id, occurred_at);

create table public.claimant_offline_code_v2_events (
  id uuid primary key default gen_random_uuid(),
  locator_record_id uuid not null references public.claimant_offline_code_v2_locators(id) on delete restrict,
  challenge_id uuid null references public.claimant_offline_code_v2_challenges(id) on delete restrict,
  event_type text not null check (event_type in (
    'locator_registered', 'challenge_issued', 'proof_invalid', 'proof_verified',
    'locator_locked', 'locator_revoked', 'locator_expired'
  )),
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (locator_record_id, event_type, idempotency_key)
);

create table public.claimant_offline_code_v2_idempotency (
  operation text not null check (operation in (
    'register_locator', 'issue_challenge', 'record_attempt', 'revoke_locator'
  )),
  scope_id uuid not null,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (operation, scope_id, idempotency_key)
);

revoke all on table public.claimant_offline_code_v2_locators from public;
revoke all on table public.claimant_offline_code_v2_locators from anon;
revoke all on table public.claimant_offline_code_v2_locators from authenticated;
revoke all on table public.claimant_offline_code_v2_challenges from public;
revoke all on table public.claimant_offline_code_v2_challenges from anon;
revoke all on table public.claimant_offline_code_v2_challenges from authenticated;
revoke all on table public.claimant_offline_code_v2_attempts from public;
revoke all on table public.claimant_offline_code_v2_attempts from anon;
revoke all on table public.claimant_offline_code_v2_attempts from authenticated;
revoke all on table public.claimant_offline_code_v2_events from public;
revoke all on table public.claimant_offline_code_v2_events from anon;
revoke all on table public.claimant_offline_code_v2_events from authenticated;
revoke all on table public.claimant_offline_code_v2_idempotency from public;
revoke all on table public.claimant_offline_code_v2_idempotency from anon;
revoke all on table public.claimant_offline_code_v2_idempotency from authenticated;
grant select, insert, update on table public.claimant_offline_code_v2_locators to service_role;
grant select, insert, update on table public.claimant_offline_code_v2_challenges to service_role;
grant select, insert on table public.claimant_offline_code_v2_attempts to service_role;
grant select, insert on table public.claimant_offline_code_v2_events to service_role;
grant select, insert on table public.claimant_offline_code_v2_idempotency to service_role;

alter table public.claimant_offline_code_v2_locators enable row level security;
alter table public.claimant_offline_code_v2_locators force row level security;
alter table public.claimant_offline_code_v2_challenges enable row level security;
alter table public.claimant_offline_code_v2_challenges force row level security;
alter table public.claimant_offline_code_v2_attempts enable row level security;
alter table public.claimant_offline_code_v2_attempts force row level security;
alter table public.claimant_offline_code_v2_events enable row level security;
alter table public.claimant_offline_code_v2_events force row level security;
alter table public.claimant_offline_code_v2_idempotency enable row level security;
alter table public.claimant_offline_code_v2_idempotency force row level security;

create policy "Offline-code V2 locators are server-only."
on public.claimant_offline_code_v2_locators for all to anon, authenticated using (false) with check (false);
create policy "Offline-code V2 challenges are server-only."
on public.claimant_offline_code_v2_challenges for all to anon, authenticated using (false) with check (false);
create policy "Offline-code V2 attempts are server-only."
on public.claimant_offline_code_v2_attempts for all to anon, authenticated using (false) with check (false);
create policy "Offline-code V2 events are server-only."
on public.claimant_offline_code_v2_events for all to anon, authenticated using (false) with check (false);
create policy "Offline-code V2 idempotency is server-only."
on public.claimant_offline_code_v2_idempotency for all to anon, authenticated using (false) with check (false);

create function public.claimant_register_offline_code_v2_locator(
  p_locator_record_id uuid, p_owner_user_id uuid, p_locator_index_digest text,
  p_locator_commitment text, p_grant_id uuid, p_proof_public_key text,
  p_record_binding_digest text, p_wrap_nonce text, p_wrap_ciphertext text,
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
    or p_wrap_nonce !~ '^[A-Za-z0-9_-]{32}$'
    or p_wrap_ciphertext !~ '^[A-Za-z0-9_-]{64}$'
    or p_wrap_associated_data_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_issued_at < now() - interval '1 minute' or p_issued_at > now() + interval '1 minute'
    or p_expires_at <= p_issued_at or p_expires_at > p_issued_at + interval '365 days' then
    raise exception 'Offline-code V2 locator input is invalid.' using errcode = '22023';
  end if;
  v_digest := encode(extensions.digest(concat_ws('|', p_locator_record_id::text,
    p_owner_user_id::text, p_locator_index_digest, p_locator_commitment, p_grant_id::text,
    p_proof_public_key, p_record_binding_digest, p_wrap_nonce,
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
      proof_public_key, record_binding_digest, wrap_nonce, wrap_ciphertext,
      wrap_associated_data_digest, issued_at, expires_at
    ) values (p_locator_record_id, p_owner_user_id, p_locator_index_digest,
      p_locator_commitment, p_grant_id, p_proof_public_key, p_record_binding_digest,
      p_wrap_nonce, p_wrap_ciphertext, p_wrap_associated_data_digest, p_issued_at, p_expires_at);
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
  p_locator_index_digest text, p_challenge_id uuid, p_locator_commitment text,
  p_record_binding_digest text, p_proof_public_key text, p_challenge_bytes_base64url text,
  p_challenge_bytes_digest text, p_origin text, p_nonce text,
  p_issued_at timestamptz, p_expires_at timestamptz, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_locator public.claimant_offline_code_v2_locators%rowtype;
  v_existing public.claimant_offline_code_v2_idempotency%rowtype;
  v_digest text; v_result jsonb;
begin
  if p_locator_index_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_locator_commitment !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_record_binding_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_proof_public_key !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or length(p_challenge_bytes_base64url) not between 64 and 8192
    or p_challenge_bytes_base64url !~ '^[A-Za-z0-9_-]+$'
    or p_challenge_bytes_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_origin !~ '^https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?$'
    or p_nonce !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_issued_at < now() - interval '1 minute' or p_issued_at > now() + interval '1 minute'
    or p_expires_at <> p_issued_at + interval '5 minutes' then
    raise exception 'Offline-code V2 challenge is unavailable.' using errcode = '40001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:offline-v2:locator:' || p_locator_index_digest, 0));
  update public.claimant_offline_code_v2_locators set status = 'expired',
    revoked_at = now(), terminal_reason = 'expired', updated_at = now()
  where locator_index_digest = p_locator_index_digest and status = 'active' and expires_at <= now();
  update public.claimant_offline_code_v2_challenges set status = 'expired', terminal_at = now()
  where status = 'issued' and expires_at <= now();
  select * into v_locator from public.claimant_offline_code_v2_locators
  where locator_index_digest = p_locator_index_digest for update;
  v_digest := encode(extensions.digest(concat_ws('|', p_locator_index_digest,
    p_challenge_id::text, p_locator_commitment, p_record_binding_digest,
    p_proof_public_key, p_challenge_bytes_digest, p_origin, p_nonce,
    p_issued_at::text, p_expires_at::text), 'sha256'), 'hex');
  if v_locator.id is not null then
    select * into v_existing from public.claimant_offline_code_v2_idempotency
    where operation = 'issue_challenge' and scope_id = v_locator.id
      and idempotency_key = p_idempotency_key;
    if found then
      if v_existing.request_digest <> v_digest then
        raise exception 'Offline-code V2 challenge idempotency changed.' using errcode = '22023';
      end if;
      return v_existing.result || jsonb_build_object('replayed', true);
    end if;
  end if;
  if v_locator.id is null or v_locator.status <> 'active' or v_locator.expires_at <= now()
    or (v_locator.locked_until is not null and v_locator.locked_until > now())
    or v_locator.locator_commitment <> p_locator_commitment
    or v_locator.record_binding_digest <> p_record_binding_digest
    or v_locator.proof_public_key <> p_proof_public_key then
    raise exception 'Offline-code V2 challenge is unavailable.' using errcode = '40001';
  end if;
  update public.claimant_offline_code_v2_challenges set status = 'expired', terminal_at = now()
  where locator_record_id = v_locator.id and status = 'issued';
  insert into public.claimant_offline_code_v2_challenges (
    id, locator_record_id, locator_version, locator_commitment, proof_key_version,
    proof_public_key, record_binding_digest, challenge_bytes_base64url,
    challenge_bytes_digest, origin, nonce, issued_at, expires_at
  ) values (p_challenge_id, v_locator.id, v_locator.locator_version,
    v_locator.locator_commitment, v_locator.proof_key_version, v_locator.proof_public_key,
    v_locator.record_binding_digest, p_challenge_bytes_base64url,
    p_challenge_bytes_digest, p_origin, p_nonce, p_issued_at, p_expires_at);
  insert into public.claimant_offline_code_v2_events
    (locator_record_id, challenge_id, event_type, idempotency_key, metadata)
  values (v_locator.id, p_challenge_id, 'challenge_issued', p_idempotency_key,
    jsonb_build_object('locator_version', 2, 'proof_key_version', 1));
  v_result := jsonb_build_object('challenge_id', p_challenge_id,
    'locator_record_id', v_locator.id, 'locator_version', 2,
    'proof_key_version', 1, 'authority', 'route_possession_only',
    'expires_at', p_expires_at, 'claim_created', false,
    'release_authorized', false, 'replayed', false);
  insert into public.claimant_offline_code_v2_idempotency
    (operation, scope_id, idempotency_key, request_digest, result)
  values ('issue_challenge', v_locator.id, p_idempotency_key,
    v_digest, v_result - 'replayed');
  return v_result;
end $function$;

create function public.claimant_record_offline_code_v2_attempt(
  p_locator_record_id uuid, p_challenge_id uuid, p_verified_challenge_bytes_digest text,
  p_verified_record_binding_digest text, p_proof_signature_digest text,
  p_verification_outcome text, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_locator public.claimant_offline_code_v2_locators%rowtype;
  v_challenge public.claimant_offline_code_v2_challenges%rowtype;
  v_existing public.claimant_offline_code_v2_idempotency%rowtype;
  v_digest text; v_result jsonb; v_attempt integer; v_locked boolean := false;
begin
  if p_verified_challenge_bytes_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_verified_record_binding_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_proof_signature_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    or p_verification_outcome not in ('invalid', 'verified') then
    raise exception 'Offline-code V2 proof attempt is unavailable.' using errcode = '40001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:offline-v2:record:' || p_locator_record_id::text, 0));
  v_digest := encode(extensions.digest(concat_ws('|', p_locator_record_id::text,
    p_challenge_id::text, p_verified_challenge_bytes_digest,
    p_verified_record_binding_digest, p_proof_signature_digest,
    p_verification_outcome), 'sha256'), 'hex');
  select * into v_existing from public.claimant_offline_code_v2_idempotency
  where operation = 'record_attempt' and scope_id = p_challenge_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Offline-code V2 attempt idempotency changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_locator from public.claimant_offline_code_v2_locators
  where id = p_locator_record_id for update;
  select * into v_challenge from public.claimant_offline_code_v2_challenges
  where id = p_challenge_id and locator_record_id = p_locator_record_id for update;
  if v_locator.id is null or v_locator.status <> 'active' or v_locator.expires_at <= now()
    or (v_locator.locked_until is not null and v_locator.locked_until > now())
    or v_challenge.id is null or v_challenge.status <> 'issued' or v_challenge.expires_at <= now()
    or v_challenge.challenge_bytes_digest <> p_verified_challenge_bytes_digest
    or v_challenge.record_binding_digest <> p_verified_record_binding_digest
    or v_locator.record_binding_digest <> p_verified_record_binding_digest then
    raise exception 'Offline-code V2 proof attempt is unavailable.' using errcode = '40001';
  end if;
  select count(*) + 1 into v_attempt from public.claimant_offline_code_v2_attempts
  where challenge_id = p_challenge_id;
  if v_attempt > 5 then
    raise exception 'Offline-code V2 proof attempt is unavailable.' using errcode = '40001';
  end if;
  insert into public.claimant_offline_code_v2_attempts (
    challenge_id, locator_record_id, attempt_number, proof_signature_digest, verification_outcome
  ) values (p_challenge_id, p_locator_record_id, v_attempt,
    p_proof_signature_digest, p_verification_outcome);
  if p_verification_outcome = 'verified' then
    update public.claimant_offline_code_v2_challenges set status = 'verified', terminal_at = now()
    where id = p_challenge_id;
    update public.claimant_offline_code_v2_locators set failed_attempt_count = 0,
      failure_window_started_at = null, locked_until = null, updated_at = now()
    where id = p_locator_record_id;
    insert into public.claimant_offline_code_v2_events
      (locator_record_id, challenge_id, event_type, idempotency_key, metadata)
    values (p_locator_record_id, p_challenge_id, 'proof_verified', p_idempotency_key,
      jsonb_build_object('attempt_number', v_attempt, 'authority', 'route_possession_only'));
  else
    update public.claimant_offline_code_v2_challenges set status = 'failed', terminal_at = now()
    where id = p_challenge_id;
    update public.claimant_offline_code_v2_locators set
      failure_window_started_at = case
        when failure_window_started_at is null
          or failure_window_started_at <= now() - interval '15 minutes' then now()
        else failure_window_started_at end,
      failed_attempt_count = case
        when failure_window_started_at is null
          or failure_window_started_at <= now() - interval '15 minutes' then 1
        else least(failed_attempt_count + 1, 5) end,
      updated_at = now()
    where id = p_locator_record_id returning * into v_locator;
    if v_locator.failed_attempt_count = 5 then
      update public.claimant_offline_code_v2_locators
      set locked_until = now() + interval '15 minutes', updated_at = now()
      where id = p_locator_record_id returning * into v_locator;
      v_locked := true;
    end if;
    insert into public.claimant_offline_code_v2_events
      (locator_record_id, challenge_id, event_type, idempotency_key, metadata)
    values (p_locator_record_id, p_challenge_id,
      case when v_locked then 'locator_locked' else 'proof_invalid' end,
      p_idempotency_key, jsonb_build_object('attempt_number', v_attempt,
        'failed_attempt_count', v_locator.failed_attempt_count));
  end if;
  v_result := jsonb_build_object('challenge_id', p_challenge_id,
    'locator_record_id', p_locator_record_id, 'verification_outcome', p_verification_outcome,
    'route_possession_asserted', p_verification_outcome = 'verified',
    'locator_locked', v_locked, 'identity_verified', false, 'claim_created', false,
    'release_authorized', false, 'replayed', false);
  insert into public.claimant_offline_code_v2_idempotency
    (operation, scope_id, idempotency_key, request_digest, result)
  values ('record_attempt', p_challenge_id, p_idempotency_key,
    v_digest, v_result - 'replayed');
  return v_result;
end $function$;

create function public.claimant_revoke_offline_code_v2_locator(
  p_locator_record_id uuid, p_owner_user_id uuid, p_expected_locator_version integer,
  p_reason text, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_locator public.claimant_offline_code_v2_locators%rowtype;
  v_existing public.claimant_offline_code_v2_idempotency%rowtype;
  v_digest text; v_result jsonb;
begin
  if p_expected_locator_version <> 2 or p_reason <> 'owner_revoked' then
    raise exception 'Offline-code V2 revocation input is invalid.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:offline-v2:record:' || p_locator_record_id::text, 0));
  v_digest := encode(extensions.digest(concat_ws('|', p_locator_record_id::text,
    p_owner_user_id::text, p_expected_locator_version::text, p_reason), 'sha256'), 'hex');
  select * into v_existing from public.claimant_offline_code_v2_idempotency
  where operation = 'revoke_locator' and scope_id = p_locator_record_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Offline-code V2 revocation idempotency changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_locator from public.claimant_offline_code_v2_locators
  where id = p_locator_record_id for update;
  if v_locator.id is null or v_locator.owner_user_id <> p_owner_user_id
    or v_locator.locator_version <> p_expected_locator_version or v_locator.status <> 'active' then
    raise exception 'Offline-code V2 revocation authority is unavailable.' using errcode = '42501';
  end if;
  update public.claimant_offline_code_v2_locators set status = 'revoked',
    revoked_at = now(), terminal_reason = 'owner_revoked', locked_until = null, updated_at = now()
  where id = p_locator_record_id;
  update public.claimant_offline_code_v2_challenges set status = 'revoked', terminal_at = now()
  where locator_record_id = p_locator_record_id and status = 'issued';
  insert into public.claimant_offline_code_v2_events
    (locator_record_id, event_type, idempotency_key, metadata)
  values (p_locator_record_id, 'locator_revoked', p_idempotency_key,
    jsonb_build_object('locator_version', 2, 'reason_class', p_reason));
  v_result := jsonb_build_object('locator_record_id', p_locator_record_id,
    'locator_version', 2, 'status', 'revoked', 'future_challenges_allowed', false,
    'claim_created', false, 'release_authorized', false, 'replayed', false);
  insert into public.claimant_offline_code_v2_idempotency
    (operation, scope_id, idempotency_key, request_digest, result)
  values ('revoke_locator', p_locator_record_id, p_idempotency_key,
    v_digest, v_result - 'replayed');
  return v_result;
end $function$;

revoke all on function public.claimant_register_offline_code_v2_locator(
  uuid, uuid, text, text, uuid, text, text, text, text, text, timestamptz, timestamptz, uuid
) from public, anon, authenticated;
revoke all on function public.claimant_issue_offline_code_v2_challenge(
  text, uuid, text, text, text, text, text, text, text, timestamptz, timestamptz, uuid
) from public, anon, authenticated;
revoke all on function public.claimant_record_offline_code_v2_attempt(
  uuid, uuid, text, text, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.claimant_revoke_offline_code_v2_locator(
  uuid, uuid, integer, text, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_register_offline_code_v2_locator(
  uuid, uuid, text, text, uuid, text, text, text, text, text, timestamptz, timestamptz, uuid
) to service_role;
grant execute on function public.claimant_issue_offline_code_v2_challenge(
  text, uuid, text, text, text, text, text, text, text, timestamptz, timestamptz, uuid
) to service_role;
grant execute on function public.claimant_record_offline_code_v2_attempt(
  uuid, uuid, text, text, text, text, uuid
) to service_role;
grant execute on function public.claimant_revoke_offline_code_v2_locator(
  uuid, uuid, integer, text, uuid
) to service_role;
