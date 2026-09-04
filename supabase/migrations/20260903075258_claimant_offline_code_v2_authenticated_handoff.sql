create table public.claimant_offline_code_v2_handoffs (
  id uuid primary key default gen_random_uuid(),
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  portal_session_id uuid not null,
  portal_session_version integer not null check (portal_session_version > 0),
  source_challenge_id uuid not null references public.claimant_offline_code_v2_challenges(id) on delete restrict,
  case_id uuid not null unique default gen_random_uuid(),
  issue_key uuid not null,
  transcript text not null check (length(transcript) between 128 and 4096),
  transcript_digest text not null check (transcript_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consume_key uuid null,
  signature_digest text null check (signature_digest ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'),
  consumed_at timestamptz null,
  result jsonb null,
  synthetic_only boolean not null default true check (synthetic_only),
  unique (claimant_user_id, issue_key),
  unique (source_challenge_id, claimant_user_id, portal_session_id),
  check (expires_at > issued_at and expires_at <= issued_at + interval '2 minutes'),
  check ((consume_key is null and signature_digest is null and consumed_at is null and result is null)
    or (consume_key is not null and signature_digest is not null and consumed_at is not null
      and result is not null and jsonb_typeof(result) = 'object'
      and consumed_at >= issued_at and consumed_at < expires_at))
);
create index claimant_offline_handoff_expiry_idx on public.claimant_offline_code_v2_handoffs(expires_at);
create index claimant_offline_handoff_account_time_idx
  on public.claimant_offline_code_v2_handoffs(claimant_user_id, issued_at);
revoke all on table public.claimant_offline_code_v2_handoffs from public;
revoke all on table public.claimant_offline_code_v2_handoffs from anon;
revoke all on table public.claimant_offline_code_v2_handoffs from authenticated;
revoke all on table public.claimant_offline_code_v2_handoffs from service_role;
grant select, insert, update on public.claimant_offline_code_v2_handoffs to service_role;
alter table public.claimant_offline_code_v2_handoffs enable row level security;
alter table public.claimant_offline_code_v2_handoffs force row level security;
create policy "Offline-code V2 handoffs are server-only."
  on public.claimant_offline_code_v2_handoffs for all to anon, authenticated
  using (false) with check (false);

create function public.claimant_offline_code_v2_handoff(
  p_action text, p_claimant_user_id uuid, p_portal_session_id uuid,
  p_request_id uuid, p_idempotency_key uuid,
  p_verified_transcript_digest text default null, p_signature_digest text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_session public.claimant_portal_session_controls%rowtype;
  v_proof public.claimant_offline_code_v2_challenges%rowtype;
  v_locator public.claimant_offline_code_v2_locators%rowtype;
  v_handoff public.claimant_offline_code_v2_handoffs%rowtype;
  v_source uuid; v_now timestamptz; v_result jsonb;
begin
  if num_nulls(p_action, p_claimant_user_id, p_portal_session_id, p_request_id, p_idempotency_key) > 0
    or p_action not in ('issue', 'load', 'consume')
    or (p_action = 'consume' and (num_nulls(p_verified_transcript_digest, p_signature_digest) > 0
      or p_verified_transcript_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
      or p_signature_digest !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'))
    or (p_action <> 'consume' and num_nonnulls(p_verified_transcript_digest, p_signature_digest) > 0) then
    raise exception 'Offline-code handoff is unavailable.' using errcode = '22023';
  end if;
  -- Same order as 5M: claimant, portal, locator, proof, then this handoff.
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:offline-v2:case-binding:' || p_claimant_user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:portal-session:' || p_claimant_user_id::text, 0));
  select * into v_session from public.claimant_portal_session_controls
    where user_id = p_claimant_user_id for update;
  v_now := clock_timestamp();
  if v_session.user_id is null or v_session.status <> 'active'
    or v_session.active_session_id <> p_portal_session_id or v_session.assurance_level <> 'aal2'
    or v_session.authenticated_at < v_now - interval '10 minutes'
    or v_session.authenticated_at > v_now + interval '1 minute'
    or not exists (select 1 from public.claimant_portal_eligibilities
      where user_id = p_claimant_user_id and status = 'eligible' and source = 'synthetic_fixture') then
    raise exception 'Offline-code handoff is unavailable.' using errcode = '28000';
  end if;
  if p_action = 'issue' then
    v_source := p_request_id;
  else
    select * into v_handoff from public.claimant_offline_code_v2_handoffs
      where id = p_request_id and claimant_user_id = p_claimant_user_id
        and portal_session_id = p_portal_session_id;
    v_source := v_handoff.source_challenge_id;
  end if;
  select * into v_proof from public.claimant_offline_code_v2_challenges where id = v_source;
  if v_proof.id is null then
    raise exception 'Offline-code handoff is unavailable.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:offline-v2:record:' || v_proof.locator_record_id::text, 0));
  select * into v_locator from public.claimant_offline_code_v2_locators
    where id = v_proof.locator_record_id for update;
  select * into v_proof from public.claimant_offline_code_v2_challenges
    where id = v_source for update;
  v_now := clock_timestamp();
  if v_proof.status <> 'verified' or v_proof.terminal_at is null
    or v_proof.terminal_at < v_now - interval '5 minutes'
    or v_proof.terminal_at > v_now + interval '1 minute'
    or v_locator.id is null or v_locator.status <> 'active' or v_locator.expires_at <= v_now
    or (v_locator.locked_until is not null and v_locator.locked_until > v_now)
    or v_locator.owner_user_id = p_claimant_user_id
    or v_locator.locator_version <> 2 or v_locator.proof_key_version <> 1
    or v_proof.locator_version <> v_locator.locator_version
    or v_proof.proof_key_version <> v_locator.proof_key_version
    or v_proof.proof_public_key <> v_locator.proof_public_key
    or v_proof.record_binding_digest <> v_locator.record_binding_digest
    or v_proof.locator_commitment <> v_locator.locator_commitment then
    raise exception 'Offline-code handoff is unavailable.' using errcode = '42501';
  end if;
  if p_action = 'issue' then
    select * into v_handoff from public.claimant_offline_code_v2_handoffs
      where claimant_user_id = p_claimant_user_id and issue_key = p_idempotency_key for update;
    if found then
      if v_handoff.source_challenge_id <> p_request_id
        or v_handoff.portal_session_id <> p_portal_session_id then
        raise exception 'Offline-code handoff is unavailable.' using errcode = '22023';
      end if;
    else
      if exists (select 1 from public.claimant_cases where offline_code_v2_locator_record_id = v_locator.id)
        or (select count(*) from public.claimant_offline_code_v2_handoffs
          where claimant_user_id = p_claimant_user_id and issued_at > v_now - interval '5 minutes') >= 5 then
        raise exception 'Offline-code handoff is unavailable.' using errcode = '42501';
      end if;
      v_handoff.id := gen_random_uuid(); v_handoff.case_id := gen_random_uuid();
      v_handoff.issued_at := v_now;
      v_handoff.expires_at := least(v_now + interval '2 minutes', v_proof.terminal_at + interval '5 minutes',
        v_locator.expires_at, v_session.authenticated_at + interval '10 minutes');
      if v_handoff.expires_at <= v_now then
        raise exception 'Offline-code handoff is unavailable.' using errcode = '42501';
      end if;
      v_handoff.transcript := jsonb_build_object(
        'protocol', 'sanduqkin:claim:offline-code:v2', 'purpose', 'authenticated_case_handoff',
        'label', 'sanduqkin:claim:offline-code:v2:authenticated-handoff:v1',
        'handoff_id', v_handoff.id, 'case_id', v_handoff.case_id,
        'claimant_user_id', p_claimant_user_id, 'portal_session_id', p_portal_session_id,
        'portal_session_version', v_session.version, 'source_challenge_id', v_proof.id,
        'record_binding_digest', v_locator.record_binding_digest,
        'expires_at_epoch', extract(epoch from v_handoff.expires_at),
        'nonce', encode(extensions.gen_random_bytes(32), 'hex'))::text;
      v_handoff.transcript_digest := rtrim(translate(encode(extensions.digest(
        convert_to(v_handoff.transcript, 'UTF8'), 'sha256'), 'base64'), '+/', '-_'), '=');
      begin
        insert into public.claimant_offline_code_v2_handoffs
          (id, claimant_user_id, portal_session_id, portal_session_version, source_challenge_id,
           case_id, issue_key, transcript, transcript_digest, issued_at, expires_at)
        values (v_handoff.id, p_claimant_user_id, p_portal_session_id, v_session.version, v_proof.id,
          v_handoff.case_id, p_idempotency_key, v_handoff.transcript, v_handoff.transcript_digest,
          v_handoff.issued_at, v_handoff.expires_at) returning * into v_handoff;
      exception when unique_violation then
        raise exception 'Offline-code handoff is unavailable.' using errcode = '40001';
      end;
    end if;
  else
    select * into v_handoff from public.claimant_offline_code_v2_handoffs
      where id = p_request_id for update;
  end if;
  if v_handoff.id is null or v_handoff.claimant_user_id <> p_claimant_user_id
    or v_handoff.portal_session_id <> p_portal_session_id
    or v_handoff.portal_session_version <> v_session.version
    or v_handoff.expires_at <= clock_timestamp() then
    raise exception 'Offline-code handoff is unavailable.' using errcode = '42501';
  end if;
  if p_action = 'consume' then
    if p_verified_transcript_digest <> v_handoff.transcript_digest then
      raise exception 'Offline-code handoff is unavailable.' using errcode = '42501';
    end if;
    if v_handoff.consumed_at is not null then
      if v_handoff.consume_key <> p_idempotency_key or v_handoff.signature_digest <> p_signature_digest then
        raise exception 'Offline-code handoff is unavailable.' using errcode = '22023';
      end if;
      return v_handoff.result || jsonb_build_object('replayed', true);
    end if;
    v_result := public.claimant_bind_offline_code_v2_case(v_handoff.case_id, p_claimant_user_id,
      p_portal_session_id, v_proof.id, v_locator.record_binding_digest,
      'synthetic_policy_death_alpha', 1, v_handoff.id);
    update public.claimant_offline_code_v2_handoffs set consume_key = p_idempotency_key,
      signature_digest = p_signature_digest, consumed_at = clock_timestamp(), result = v_result
      where id = v_handoff.id;
    return v_result;
  end if;
  return jsonb_build_object('handoff_id', v_handoff.id, 'case_id', v_handoff.case_id,
    'claimant_user_id', p_claimant_user_id, 'portal_session_id', p_portal_session_id,
    'portal_session_version', v_session.version, 'source_challenge_id', v_proof.id,
    'proof_public_key', v_locator.proof_public_key, 'expires_at', v_handoff.expires_at,
    'transcript_bytes_base64url', rtrim(translate(replace(encode(convert_to(
      v_handoff.transcript, 'UTF8'), 'base64'), E'\n', ''), '+/', '-_'), '='),
    'transcript_digest', v_handoff.transcript_digest, 'authority', 'route_possession_only',
    'identity_verified', false, 'claim_created', false, 'release_authorized', false,
    'synthetic_only', true);
end $function$;
revoke all on function public.claimant_offline_code_v2_handoff(text, uuid, uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claimant_offline_code_v2_handoff(text, uuid, uuid, uuid, uuid, text, text)
  to service_role;
