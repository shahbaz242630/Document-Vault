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
    'issue_native_enrollment_challenge', 'accept_native_enrollment'
  )
);

create table public.claimant_app_attest_challenges (
  id uuid primary key,
  purpose text not null check (purpose in ('registration', 'native_enrollment_assertion')),
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  portal_session_id uuid not null,
  app_attest_key_id_digest text not null check (app_attest_key_id_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  app_id_hash text not null check (app_id_hash ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  environment text not null check (environment in ('development', 'production')),
  required_bundle_version text not null check (required_bundle_version ~ '^[0-9]+(?:\.[0-9]+){0,2}$'),
  required_validation_category integer not null check (required_validation_category in (2, 3, 4)),
  challenge_bytes_base64url text not null check (
    length(challenge_bytes_base64url) between 22 and 8192 and challenge_bytes_base64url ~ '^[A-Za-z0-9_-]+$'
  ),
  challenge_bytes_digest text not null check (challenge_bytes_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  native_enrollment_challenge_digest text null check (
    native_enrollment_challenge_digest is null or native_enrollment_challenge_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
  ),
  status text not null default 'issued' check (status in ('issued', 'consumed', 'expired')),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  check (expires_at = issued_at + interval '5 minutes'),
  check ((status in ('issued', 'expired') and consumed_at is null) or (status = 'consumed' and consumed_at is not null)),
  check (
    (purpose = 'registration' and native_enrollment_challenge_digest is null)
    or (purpose = 'native_enrollment_assertion' and native_enrollment_challenge_digest is not null)
  )
);

create index claimant_app_attest_challenges_expiry_idx
on public.claimant_app_attest_challenges (status, expires_at);
create unique index claimant_app_attest_one_open_registration_idx
on public.claimant_app_attest_challenges (claimant_user_id, app_attest_key_id_digest)
where purpose = 'registration' and status = 'issued';

create table public.claimant_native_enrollment_challenges (
  id uuid primary key,
  app_attest_assertion_challenge_id uuid not null unique
    references public.claimant_app_attest_challenges(id) on delete restrict,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  portal_session_id uuid not null,
  invitation_id uuid not null references public.claimant_invitations(id) on delete restrict,
  invitation_version integer not null check (invitation_version > 0),
  recipient_address_digest text not null check (recipient_address_digest ~ '^[0-9a-f]{64}$'),
  eligibility_version integer not null check (eligibility_version > 0),
  claimant_key_id uuid not null unique,
  claimant_key_version integer not null default 1 check (claimant_key_version = 1),
  device_binding_digest text not null check (device_binding_digest ~ '^[0-9a-f]{64}$'),
  public_key_x963_base64url text not null check (public_key_x963_base64url ~ '^B[A-P][A-Za-z0-9_-]{84}[AEIMQUYcgkosw048]$'),
  public_key_fingerprint text not null check (public_key_fingerprint ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  public_key_jwk jsonb not null check (
    jsonb_typeof(public_key_jwk) = 'object' and public_key_jwk @> '{"kty":"EC","crv":"P-256"}'::jsonb
    and jsonb_typeof(public_key_jwk -> 'x') = 'string' and jsonb_typeof(public_key_jwk -> 'y') = 'string'
    and length(public_key_jwk ->> 'x') = 43 and length(public_key_jwk ->> 'y') = 43 and not (public_key_jwk ? 'd')
  ),
  policy_pack_id text not null check (length(policy_pack_id) between 1 and 200),
  policy_pack_version integer not null check (policy_pack_version > 0),
  origin text not null check (origin ~ '^https://[^/]+$'),
  challenge_bytes_base64url text not null check (
    length(challenge_bytes_base64url) between 22 and 8192 and challenge_bytes_base64url ~ '^[A-Za-z0-9_-]+$'
  ),
  challenge_bytes_digest text not null check (challenge_bytes_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  server_ephemeral_private_key_envelope text not null check (length(server_ephemeral_private_key_envelope) between 80 and 2048),
  app_attest_key_id_digest text not null check (app_attest_key_id_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  status text not null default 'issued' check (status in ('issued', 'consumed', 'expired')),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  check (expires_at = issued_at + interval '5 minutes'),
  check ((status in ('issued', 'expired') and consumed_at is null) or (status = 'consumed' and consumed_at is not null))
);

create unique index claimant_native_enrollment_one_open_invitation_idx
on public.claimant_native_enrollment_challenges (claimant_user_id, invitation_id)
where status = 'issued';
create index claimant_native_enrollment_expiry_idx
on public.claimant_native_enrollment_challenges (status, expires_at);

revoke all on table public.claimant_app_attest_challenges from public;
revoke all on table public.claimant_app_attest_challenges from anon;
revoke all on table public.claimant_app_attest_challenges from authenticated;
revoke all on table public.claimant_native_enrollment_challenges from public;
revoke all on table public.claimant_native_enrollment_challenges from anon;
revoke all on table public.claimant_native_enrollment_challenges from authenticated;
grant select, insert, update on table public.claimant_app_attest_challenges to service_role;
grant select, insert, update on table public.claimant_native_enrollment_challenges to service_role;
alter table public.claimant_app_attest_challenges enable row level security;
alter table public.claimant_app_attest_challenges force row level security;
alter table public.claimant_native_enrollment_challenges enable row level security;
alter table public.claimant_native_enrollment_challenges force row level security;
create policy "Claimant App Attest challenges are server-only."
on public.claimant_app_attest_challenges for all to anon, authenticated using (false) with check (false);
create policy "Claimant native enrollment challenges are server-only."
on public.claimant_native_enrollment_challenges for all to anon, authenticated using (false) with check (false);

create function public.claimant_issue_app_attest_registration_challenge(
  p_claimant_user_id uuid, p_portal_session_id uuid, p_challenge_id uuid,
  p_app_attest_key_id_digest text, p_app_id_hash text, p_environment text,
  p_required_bundle_version text, p_required_validation_category integer,
  p_challenge_bytes_base64url text, p_challenge_bytes_digest text,
  p_issued_at timestamptz, p_expires_at timestamptz, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_existing public.claimant_idempotency_records%rowtype; v_digest text; v_result jsonb;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  if p_issued_at < now() - interval '1 minute' or p_issued_at > now() + interval '1 minute'
    or p_expires_at <> p_issued_at + interval '5 minutes' then
    raise exception 'App Attest challenge window is invalid.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('claimant:app-attest-registration:' || p_claimant_user_id::text, 0));
  update public.claimant_app_attest_challenges set status = 'expired'
    where claimant_user_id = p_claimant_user_id and app_attest_key_id_digest = p_app_attest_key_id_digest
      and purpose = 'registration' and status = 'issued' and expires_at <= now();
  v_digest := encode(extensions.digest(concat_ws('|', p_claimant_user_id::text, p_portal_session_id::text,
    p_challenge_id::text, p_app_attest_key_id_digest, p_app_id_hash, p_environment,
    p_required_bundle_version, p_required_validation_category::text, p_challenge_bytes_digest,
    p_issued_at::text, p_expires_at::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
    where operation = 'issue_app_attest_registration_challenge' and actor_user_id = p_claimant_user_id
      and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then raise exception 'Idempotency key input changed.' using errcode = '22023'; end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  insert into public.claimant_app_attest_challenges (
    id, purpose, claimant_user_id, portal_session_id, app_attest_key_id_digest, app_id_hash,
    environment, required_bundle_version, required_validation_category, challenge_bytes_base64url,
    challenge_bytes_digest, issued_at, expires_at
  ) values (p_challenge_id, 'registration', p_claimant_user_id, p_portal_session_id,
    p_app_attest_key_id_digest, p_app_id_hash, p_environment, p_required_bundle_version,
    p_required_validation_category, p_challenge_bytes_base64url, p_challenge_bytes_digest,
    p_issued_at, p_expires_at);
  v_result := jsonb_build_object('challenge_id', p_challenge_id, 'expires_at', p_expires_at, 'replayed', false);
  insert into public.claimant_idempotency_records (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('issue_app_attest_registration_challenge', p_claimant_user_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end
$function$;

create function public.claimant_consume_app_attest_registration_challenge(
  p_claimant_user_id uuid, p_portal_session_id uuid, p_challenge_id uuid,
  p_verified_challenge_bytes_digest text, p_verified_app_attest_key_id_digest text,
  p_public_key_spki_base64 text,
  p_attestation_receipt_base64 text, p_verified_bundle_version text,
  p_verified_validation_category integer, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_challenge public.claimant_app_attest_challenges%rowtype; v_existing public.claimant_idempotency_records%rowtype;
  v_digest text; v_registration jsonb; v_result jsonb;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  perform pg_advisory_xact_lock(hashtextextended('claimant:app-attest-challenge:' || p_challenge_id::text, 0));
  v_digest := encode(extensions.digest(concat_ws('|', p_claimant_user_id::text, p_portal_session_id::text,
    p_challenge_id::text, p_verified_challenge_bytes_digest, p_verified_app_attest_key_id_digest,
    p_public_key_spki_base64,
    encode(extensions.digest(decode(p_attestation_receipt_base64, 'base64'), 'sha256'), 'hex'),
    p_verified_bundle_version, p_verified_validation_category::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
    where operation = 'consume_app_attest_registration_challenge' and actor_user_id = p_claimant_user_id
      and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then raise exception 'Idempotency key input changed.' using errcode = '22023'; end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_challenge from public.claimant_app_attest_challenges where id = p_challenge_id for update;
  if not found or v_challenge.purpose <> 'registration' or v_challenge.status <> 'issued'
    or v_challenge.expires_at <= now() or v_challenge.claimant_user_id <> p_claimant_user_id
    or v_challenge.portal_session_id <> p_portal_session_id
    or v_challenge.challenge_bytes_digest <> p_verified_challenge_bytes_digest
    or v_challenge.app_attest_key_id_digest <> p_verified_app_attest_key_id_digest
    or v_challenge.required_bundle_version <> p_verified_bundle_version
    or v_challenge.required_validation_category <> p_verified_validation_category then
    raise exception 'App Attest registration challenge is unavailable.' using errcode = '40001';
  end if;
  v_registration := public.claimant_register_app_attest_key(
    p_claimant_user_id, p_portal_session_id, v_challenge.app_attest_key_id_digest,
    v_challenge.app_id_hash, p_public_key_spki_base64, p_attestation_receipt_base64,
    v_challenge.environment, p_verified_bundle_version, p_verified_validation_category, p_idempotency_key
  );
  update public.claimant_app_attest_challenges set status = 'consumed', consumed_at = now()
    where id = p_challenge_id;
  v_result := (v_registration - 'replayed') || jsonb_build_object('challenge_id', p_challenge_id, 'replayed', false);
  insert into public.claimant_idempotency_records (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('consume_app_attest_registration_challenge', p_claimant_user_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end
$function$;

create function public.claimant_get_app_attest_registration_challenge(
  p_claimant_user_id uuid, p_portal_session_id uuid, p_challenge_id uuid
) returns jsonb language plpgsql stable security invoker set search_path = '' as $function$
declare v_challenge public.claimant_app_attest_challenges%rowtype;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  select * into v_challenge from public.claimant_app_attest_challenges
    where id = p_challenge_id and claimant_user_id = p_claimant_user_id
      and portal_session_id = p_portal_session_id and purpose = 'registration';
  if not found or v_challenge.status <> 'issued' or v_challenge.expires_at <= now() then
    raise exception 'App Attest registration challenge is unavailable.' using errcode = '40001';
  end if;
  return jsonb_build_object(
    'challenge_bytes_base64url', v_challenge.challenge_bytes_base64url,
    'challenge_bytes_digest', v_challenge.challenge_bytes_digest
  );
end
$function$;

create function public.claimant_issue_native_enrollment_challenge(
  p_claimant_user_id uuid, p_portal_session_id uuid, p_native_challenge_id uuid,
  p_app_attest_challenge_id uuid, p_invitation_id uuid, p_expected_invitation_version integer,
  p_recipient_address_digest text, p_expected_eligibility_version integer, p_claimant_key_id uuid,
  p_device_binding_digest text, p_public_key_x963_base64url text, p_public_key_fingerprint text,
  p_public_key_jwk jsonb, p_policy_pack_id text, p_policy_pack_version integer, p_origin text,
  p_native_challenge_bytes_base64url text, p_native_challenge_bytes_digest text,
  p_server_ephemeral_private_key_envelope text, p_app_attest_key_id_digest text,
  p_app_attest_challenge_bytes_base64url text, p_app_attest_challenge_bytes_digest text,
  p_app_id_hash text, p_environment text, p_required_bundle_version text,
  p_required_validation_category integer, p_issued_at timestamptz, p_expires_at timestamptz,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_invitation public.claimant_invitations%rowtype; v_existing public.claimant_idempotency_records%rowtype;
  v_eligibility public.claimant_portal_eligibilities%rowtype; v_digest text; v_result jsonb;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  perform pg_advisory_xact_lock(hashtextextended('claimant:native-enrollment:' || p_claimant_user_id::text || ':' || p_invitation_id::text, 0));
  update public.claimant_native_enrollment_challenges set status = 'expired'
    where claimant_user_id = p_claimant_user_id and invitation_id = p_invitation_id
      and status = 'issued' and expires_at <= now();
  update public.claimant_app_attest_challenges set status = 'expired'
    where claimant_user_id = p_claimant_user_id and purpose = 'native_enrollment_assertion'
      and status = 'issued' and expires_at <= now();
  select * into v_eligibility from public.claimant_portal_eligibilities where user_id = p_claimant_user_id;
  select * into v_invitation from public.claimant_invitations where id = p_invitation_id for update;
  if v_eligibility.user_id is null or v_eligibility.status <> 'eligible'
    or v_eligibility.version <> p_expected_eligibility_version
    or v_invitation.id is null or v_invitation.status <> 'pending' or v_invitation.expires_at <= now()
    or v_invitation.version <> p_expected_invitation_version
    or v_invitation.recipient_address_digest <> p_recipient_address_digest
    or v_invitation.owner_user_id = p_claimant_user_id
    or not exists (select 1 from public.claimant_app_attest_keys where claimant_user_id = p_claimant_user_id
      and app_attest_key_id_digest = p_app_attest_key_id_digest and app_id_hash = p_app_id_hash
      and environment = p_environment and status = 'active')
    or p_expires_at <> p_issued_at + interval '5 minutes' or p_issued_at < now() - interval '1 minute'
    or p_issued_at > now() + interval '1 minute' then
    raise exception 'Native enrollment challenge is unavailable.' using errcode = '42501';
  end if;
  v_digest := encode(extensions.digest(concat_ws('|', p_claimant_user_id::text, p_portal_session_id::text,
    p_native_challenge_id::text, p_app_attest_challenge_id::text, p_invitation_id::text,
    p_expected_invitation_version::text, p_expected_eligibility_version::text, p_claimant_key_id::text,
    p_device_binding_digest, p_public_key_fingerprint, p_policy_pack_id, p_policy_pack_version::text,
    p_native_challenge_bytes_digest, p_app_attest_challenge_bytes_digest, p_app_attest_key_id_digest,
    p_issued_at::text, p_expires_at::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
    where operation = 'issue_native_enrollment_challenge' and actor_user_id = p_claimant_user_id
      and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then raise exception 'Idempotency key input changed.' using errcode = '22023'; end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  insert into public.claimant_app_attest_challenges (
    id, purpose, claimant_user_id, portal_session_id, app_attest_key_id_digest, app_id_hash,
    environment, required_bundle_version, required_validation_category, challenge_bytes_base64url,
    challenge_bytes_digest, native_enrollment_challenge_digest, issued_at, expires_at
  ) values (p_app_attest_challenge_id, 'native_enrollment_assertion', p_claimant_user_id,
    p_portal_session_id, p_app_attest_key_id_digest, p_app_id_hash, p_environment,
    p_required_bundle_version, p_required_validation_category, p_app_attest_challenge_bytes_base64url,
    p_app_attest_challenge_bytes_digest, p_native_challenge_bytes_digest, p_issued_at, p_expires_at);
  insert into public.claimant_native_enrollment_challenges (
    id, app_attest_assertion_challenge_id, claimant_user_id, portal_session_id, invitation_id,
    invitation_version, recipient_address_digest, eligibility_version, claimant_key_id,
    device_binding_digest, public_key_x963_base64url, public_key_fingerprint, public_key_jwk,
    policy_pack_id, policy_pack_version, origin, challenge_bytes_base64url, challenge_bytes_digest,
    server_ephemeral_private_key_envelope, app_attest_key_id_digest, issued_at, expires_at
  ) values (p_native_challenge_id, p_app_attest_challenge_id, p_claimant_user_id,
    p_portal_session_id, p_invitation_id, p_expected_invitation_version, p_recipient_address_digest,
    p_expected_eligibility_version, p_claimant_key_id, p_device_binding_digest,
    p_public_key_x963_base64url, p_public_key_fingerprint, p_public_key_jwk, p_policy_pack_id,
    p_policy_pack_version, p_origin, p_native_challenge_bytes_base64url,
    p_native_challenge_bytes_digest, p_server_ephemeral_private_key_envelope,
    p_app_attest_key_id_digest, p_issued_at, p_expires_at);
  v_result := jsonb_build_object('native_challenge_id', p_native_challenge_id,
    'app_attest_challenge_id', p_app_attest_challenge_id, 'expires_at', p_expires_at, 'replayed', false);
  insert into public.claimant_idempotency_records (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('issue_native_enrollment_challenge', p_claimant_user_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end
$function$;

create function public.claimant_accept_native_enrollment(
  p_claimant_user_id uuid, p_portal_session_id uuid, p_native_challenge_id uuid,
  p_app_attest_challenge_id uuid, p_verified_native_challenge_digest text,
  p_verified_app_attest_challenge_digest text, p_expected_app_attest_counter bigint,
  p_verified_app_attest_counter bigint, p_verified_bundle_version text,
  p_verified_validation_category integer, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_native public.claimant_native_enrollment_challenges%rowtype;
  v_app_challenge public.claimant_app_attest_challenges%rowtype; v_app_key public.claimant_app_attest_keys%rowtype;
  v_invitation public.claimant_invitations%rowtype; v_existing public.claimant_idempotency_records%rowtype;
  v_case public.claimant_cases%rowtype; v_digest text; v_result jsonb;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  perform pg_advisory_xact_lock(hashtextextended('claimant:native-enrollment-challenge:' || p_native_challenge_id::text, 0));
  v_digest := encode(extensions.digest(concat_ws('|', p_claimant_user_id::text, p_portal_session_id::text,
    p_native_challenge_id::text, p_app_attest_challenge_id::text, p_verified_native_challenge_digest,
    p_verified_app_attest_challenge_digest, p_expected_app_attest_counter::text,
    p_verified_app_attest_counter::text, p_verified_bundle_version,
    p_verified_validation_category::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
    where operation = 'accept_native_enrollment' and actor_user_id = p_claimant_user_id
      and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then raise exception 'Idempotency key input changed.' using errcode = '22023'; end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_native from public.claimant_native_enrollment_challenges where id = p_native_challenge_id for update;
  select * into v_app_challenge from public.claimant_app_attest_challenges where id = p_app_attest_challenge_id for update;
  if v_native.id is null or v_app_challenge.id is null
    or v_native.status <> 'issued' or v_app_challenge.status <> 'issued'
    or v_native.expires_at <= now() or v_app_challenge.expires_at <= now()
    or v_native.claimant_user_id <> p_claimant_user_id or v_native.portal_session_id <> p_portal_session_id
    or v_native.app_attest_assertion_challenge_id <> p_app_attest_challenge_id
    or v_app_challenge.purpose <> 'native_enrollment_assertion'
    or v_app_challenge.claimant_user_id <> p_claimant_user_id
    or v_app_challenge.portal_session_id <> p_portal_session_id
    or v_app_challenge.app_attest_key_id_digest <> v_native.app_attest_key_id_digest
    or v_app_challenge.expires_at <> v_native.expires_at
    or v_app_challenge.challenge_bytes_digest <> p_verified_app_attest_challenge_digest
    or v_app_challenge.native_enrollment_challenge_digest <> p_verified_native_challenge_digest
    or v_native.challenge_bytes_digest <> p_verified_native_challenge_digest
    or v_app_challenge.required_bundle_version <> p_verified_bundle_version
    or v_app_challenge.required_validation_category <> p_verified_validation_category then
    raise exception 'Native enrollment challenge is unavailable.' using errcode = '40001';
  end if;
  select * into v_app_key from public.claimant_app_attest_keys
    where claimant_user_id = p_claimant_user_id
      and app_attest_key_id_digest = v_native.app_attest_key_id_digest for update;
  if v_app_key.id is null or v_app_key.status <> 'active' or v_app_key.assertion_counter <> p_expected_app_attest_counter
    or p_verified_app_attest_counter <= v_app_key.assertion_counter then
    raise exception 'App Attest assertion counter is stale.' using errcode = '40001';
  end if;
  select * into v_invitation from public.claimant_invitations where id = v_native.invitation_id for update;
  if v_invitation.id is null or v_invitation.status <> 'pending' or v_invitation.expires_at <= now()
    or v_invitation.version <> v_native.invitation_version
    or v_invitation.recipient_address_digest <> v_native.recipient_address_digest
    or v_invitation.owner_user_id = p_claimant_user_id
    or not exists (select 1 from public.claimant_portal_eligibilities where user_id = p_claimant_user_id
      and status = 'eligible' and version = v_native.eligibility_version) then
    raise exception 'Registered-recipient invitation is unavailable.' using errcode = '40001';
  end if;
  insert into public.claimant_identities (user_id, status) values (p_claimant_user_id, 'active')
    on conflict (user_id) do update set status = 'active', version = public.claimant_identities.version + 1,
      updated_at = now() where public.claimant_identities.status = 'pending';
  if not exists (select 1 from public.claimant_identities where user_id = p_claimant_user_id and status = 'active') then
    raise exception 'Claimant identity is unavailable.' using errcode = '42501';
  end if;
  insert into public.claimant_device_keys (
    id, claimant_user_id, device_binding_digest, public_key_jwk, key_version
  ) values (v_native.claimant_key_id, p_claimant_user_id, v_native.device_binding_digest,
    v_native.public_key_jwk, v_native.claimant_key_version);
  update public.claimant_invitations set status = 'accepted', accepted_by_user_id = p_claimant_user_id,
    accepted_at = now(), version = version + 1, updated_at = now()
  where id = v_native.invitation_id and status = 'pending' and version = v_native.invitation_version
  returning * into v_invitation;
  if not found then raise exception 'Registered-recipient invitation changed during acceptance.' using errcode = '40001'; end if;
  insert into public.claimant_cases (
    claimant_user_id, owner_user_id, invitation_id, current_key_id, policy_pack_id, policy_pack_version
  ) values (p_claimant_user_id, v_invitation.owner_user_id, v_invitation.id,
    v_native.claimant_key_id, v_native.policy_pack_id, v_native.policy_pack_version) returning * into v_case;
  update public.claimant_app_attest_keys set assertion_counter = p_verified_app_attest_counter,
    last_asserted_bundle_version = p_verified_bundle_version,
    last_asserted_validation_category = p_verified_validation_category,
    last_asserted_at = now(), updated_at = now() where id = v_app_key.id;
  update public.claimant_app_attest_challenges set status = 'consumed', consumed_at = now()
    where id = p_app_attest_challenge_id;
  update public.claimant_native_enrollment_challenges set status = 'consumed', consumed_at = now()
    where id = p_native_challenge_id;
  insert into public.claimant_app_attest_events (
    event_type, claimant_user_id, app_attest_key_id, claimant_key_id, idempotency_key,
    assertion_counter, metadata
  ) values ('app_attest_assertion_verified', p_claimant_user_id, v_app_key.id,
    v_native.claimant_key_id, p_idempotency_key, p_verified_app_attest_counter,
    jsonb_build_object('bundle_version', p_verified_bundle_version,
      'validation_category', p_verified_validation_category));
  insert into public.claimant_audit_events (
    event_type, actor_user_id, invitation_id, case_id, idempotency_key, metadata
  ) values
    ('registered_invitation_accepted', p_claimant_user_id, v_invitation.id, v_case.id,
      p_idempotency_key, jsonb_build_object('invitation_version', v_invitation.version)),
    ('claimant_key_enrolled', p_claimant_user_id, v_invitation.id, v_case.id,
      p_idempotency_key, jsonb_build_object('key_version', v_native.claimant_key_version, 'algorithm', 'p256_ecdh')),
    ('claim_draft_created', p_claimant_user_id, v_invitation.id, v_case.id,
      p_idempotency_key, jsonb_build_object('case_version', v_case.version, 'route_profile', v_case.route_profile));
  insert into public.claimant_outbox (topic, aggregate_type, aggregate_id, dedupe_key, payload)
  values ('registered_recipient_case_created', 'case', v_case.id,
    'registered_recipient_case_created:native:' || p_idempotency_key::text,
    jsonb_build_object('event', 'registered_recipient_case_created'));
  v_result := jsonb_build_object('case_id', v_case.id, 'case_version', v_case.version,
    'claimant_key_id', v_native.claimant_key_id, 'invitation_id', v_invitation.id,
    'invitation_version', v_invitation.version, 'assertion_counter', p_verified_app_attest_counter,
    'replayed', false);
  insert into public.claimant_idempotency_records (operation, actor_user_id, idempotency_key, request_digest, result)
  values ('accept_native_enrollment', p_claimant_user_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end
$function$;

create function public.claimant_get_native_enrollment_evidence(
  p_claimant_user_id uuid, p_portal_session_id uuid, p_native_challenge_id uuid,
  p_app_attest_challenge_id uuid
) returns jsonb language plpgsql stable security invoker set search_path = '' as $function$
declare v_native public.claimant_native_enrollment_challenges%rowtype;
  v_app public.claimant_app_attest_challenges%rowtype;
  v_key public.claimant_app_attest_keys%rowtype;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  select * into v_native from public.claimant_native_enrollment_challenges
    where id = p_native_challenge_id and claimant_user_id = p_claimant_user_id
      and portal_session_id = p_portal_session_id;
  select * into v_app from public.claimant_app_attest_challenges
    where id = p_app_attest_challenge_id and claimant_user_id = p_claimant_user_id
      and portal_session_id = p_portal_session_id;
  if v_native.id is null or v_app.id is null or v_native.status <> 'issued' or v_app.status <> 'issued'
    or v_native.expires_at <= now() or v_app.expires_at <= now()
    or v_native.app_attest_assertion_challenge_id <> v_app.id
    or v_app.purpose <> 'native_enrollment_assertion' then
    raise exception 'Native enrollment challenge is unavailable.' using errcode = '40001';
  end if;
  select * into v_key from public.claimant_app_attest_keys
    where claimant_user_id = p_claimant_user_id
      and app_attest_key_id_digest = v_native.app_attest_key_id_digest and status = 'active';
  if not found then raise exception 'App Attest key is unavailable.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'app_attest_challenge_bytes_base64url', v_app.challenge_bytes_base64url,
    'app_attest_challenge_bytes_digest', v_app.challenge_bytes_digest,
    'app_attest_challenge_id', v_app.id,
    'app_attest_key_id_digest', v_native.app_attest_key_id_digest,
    'app_attest_public_key_spki_base64', v_key.public_key_spki_base64,
    'claimant_public_key_base64url', v_native.public_key_x963_base64url,
    'claimant_user_id', v_native.claimant_user_id,
    'native_challenge_bytes_base64url', v_native.challenge_bytes_base64url,
    'native_challenge_bytes_digest', v_native.challenge_bytes_digest,
    'native_challenge_id', v_native.id,
    'previous_app_attest_counter', v_key.assertion_counter,
    'server_ephemeral_private_key_envelope', v_native.server_ephemeral_private_key_envelope
  );
end
$function$;

revoke all on function public.claimant_issue_app_attest_registration_challenge(uuid, uuid, uuid, text, text, text, text, integer, text, text, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.claimant_consume_app_attest_registration_challenge(uuid, uuid, uuid, text, text, text, text, text, integer, uuid) from public, anon, authenticated;
revoke all on function public.claimant_get_app_attest_registration_challenge(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.claimant_issue_native_enrollment_challenge(uuid, uuid, uuid, uuid, uuid, integer, text, integer, uuid, text, text, text, jsonb, text, integer, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.claimant_accept_native_enrollment(uuid, uuid, uuid, uuid, text, text, bigint, bigint, text, integer, uuid) from public, anon, authenticated;
revoke all on function public.claimant_get_native_enrollment_evidence(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claimant_issue_app_attest_registration_challenge(uuid, uuid, uuid, text, text, text, text, integer, text, text, timestamptz, timestamptz, uuid) to service_role;
grant execute on function public.claimant_consume_app_attest_registration_challenge(uuid, uuid, uuid, text, text, text, text, text, integer, uuid) to service_role;
grant execute on function public.claimant_get_app_attest_registration_challenge(uuid, uuid, uuid) to service_role;
grant execute on function public.claimant_issue_native_enrollment_challenge(uuid, uuid, uuid, uuid, uuid, integer, text, integer, uuid, text, text, text, jsonb, text, integer, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, timestamptz, uuid) to service_role;
grant execute on function public.claimant_accept_native_enrollment(uuid, uuid, uuid, uuid, text, text, bigint, bigint, text, integer, uuid) to service_role;
grant execute on function public.claimant_get_native_enrollment_evidence(uuid, uuid, uuid, uuid) to service_role;
