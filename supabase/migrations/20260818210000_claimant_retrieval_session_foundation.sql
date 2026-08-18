create table public.claimant_release_retrieval_sessions (
  id uuid primary key,
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  finalization_id uuid not null,
  package_id uuid not null,
  claimant_user_id uuid not null
    references public.claimant_identities(user_id) on delete restrict,
  portal_session_id uuid not null,
  portal_session_version integer not null check (portal_session_version > 0),
  grant_id uuid not null references public.claimant_recipient_grants(id) on delete restrict,
  recipient_key_id uuid not null
    references public.claimant_device_keys(id) on delete restrict,
  recipient_key_version integer not null check (recipient_key_version > 0),
  source_case_version integer not null check (source_case_version > 3),
  purpose text not null default 'single_package_retrieval'
    check (purpose = 'single_package_retrieval'),
  status text not null default 'authorized_unserved'
    check (status = 'authorized_unserved'),
  assurance_level text not null default 'aal2' check (assurance_level = 'aal2'),
  authenticated_at timestamptz not null,
  authorized_at timestamptz not null default now(),
  expires_at timestamptz not null,
  package_serving_authorized boolean not null default false
    check (not package_serving_authorized),
  package_served boolean not null default false check (not package_served),
  retrieval_completed boolean not null default false check (not retrieval_completed),
  synthetic_only boolean not null default true check (synthetic_only),
  unique (package_id, portal_session_id, grant_id),
  unique (id, case_id),
  foreign key (finalization_id, case_id)
    references public.claimant_release_package_finalizations(id, case_id) on delete restrict,
  foreign key (package_id, case_id)
    references public.claimant_release_packages(id, case_id) on delete restrict,
  foreign key (recipient_key_id, claimant_user_id)
    references public.claimant_device_keys(id, claimant_user_id) on delete restrict,
  check (authenticated_at <= authorized_at + interval '1 minute'),
  check (authorized_at - authenticated_at <= interval '10 minutes'),
  check (expires_at > authorized_at),
  check (expires_at <= authorized_at + interval '15 minutes')
);

create table public.claimant_release_retrieval_session_events (
  id uuid primary key default gen_random_uuid(),
  retrieval_session_id uuid not null,
  case_id uuid not null,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type = 'retrieval_session_authorized'),
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and metadata = '{}'::jsonb),
  unique (case_id, claimant_user_id, idempotency_key, event_type),
  foreign key (retrieval_session_id, case_id)
    references public.claimant_release_retrieval_sessions(id, case_id) on delete restrict
);

create table public.claimant_release_retrieval_session_idempotency (
  operation text not null check (operation = 'authorize_release_retrieval_session'),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and not (result ?| array['ciphertext', 'nonce', 'canonical_manifest',
      'detached_signature', 'public_key', 'token', 'signed_url'])
  ),
  created_at timestamptz not null default now(),
  primary key (operation, case_id, claimant_user_id, idempotency_key)
);

create index claimant_release_retrieval_sessions_case_claimant_idx
on public.claimant_release_retrieval_sessions (case_id, claimant_user_id);
create index claimant_release_retrieval_sessions_finalization_case_idx
on public.claimant_release_retrieval_sessions (finalization_id, case_id);
create index claimant_release_retrieval_sessions_package_case_idx
on public.claimant_release_retrieval_sessions (package_id, case_id);
create index claimant_release_retrieval_sessions_claimant_expiry_idx
on public.claimant_release_retrieval_sessions (claimant_user_id, expires_at desc);
create index claimant_release_retrieval_sessions_grant_idx
on public.claimant_release_retrieval_sessions (grant_id);
create index claimant_release_retrieval_sessions_key_idx
on public.claimant_release_retrieval_sessions (recipient_key_id);
create index claimant_release_retrieval_events_claimant_idx
on public.claimant_release_retrieval_session_events (claimant_user_id, occurred_at desc);
create index claimant_release_retrieval_idempotency_claimant_idx
on public.claimant_release_retrieval_session_idempotency (claimant_user_id);

revoke all on table public.claimant_release_retrieval_sessions from public;
revoke all on table public.claimant_release_retrieval_sessions from anon;
revoke all on table public.claimant_release_retrieval_sessions from authenticated;
revoke all on table public.claimant_release_retrieval_session_events from public;
revoke all on table public.claimant_release_retrieval_session_events from anon;
revoke all on table public.claimant_release_retrieval_session_events from authenticated;
revoke all on table public.claimant_release_retrieval_session_idempotency from public;
revoke all on table public.claimant_release_retrieval_session_idempotency from anon;
revoke all on table public.claimant_release_retrieval_session_idempotency from authenticated;

grant select, insert on table public.claimant_release_retrieval_sessions to service_role;
grant select, insert on table public.claimant_release_retrieval_session_events to service_role;
grant select, insert on table public.claimant_release_retrieval_session_idempotency to service_role;

alter table public.claimant_release_retrieval_sessions enable row level security;
alter table public.claimant_release_retrieval_sessions force row level security;
alter table public.claimant_release_retrieval_session_events enable row level security;
alter table public.claimant_release_retrieval_session_events force row level security;
alter table public.claimant_release_retrieval_session_idempotency enable row level security;
alter table public.claimant_release_retrieval_session_idempotency force row level security;

create policy "Claimant release retrieval sessions are server-only."
on public.claimant_release_retrieval_sessions for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release retrieval session events are server-only."
on public.claimant_release_retrieval_session_events for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release retrieval session idempotency is server-only."
on public.claimant_release_retrieval_session_idempotency for all to anon, authenticated
using (false) with check (false);

create function public.claimant_authorize_release_retrieval_session(
  p_retrieval_session_id uuid,
  p_claimant_user_id uuid,
  p_portal_session_id uuid,
  p_authenticated_at timestamptz,
  p_case_id uuid,
  p_expected_case_version integer,
  p_finalization_id uuid,
  p_package_id uuid,
  p_grant_id uuid,
  p_recipient_key_id uuid,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_authorized_at timestamptz := now();
  v_case public.claimant_cases%rowtype;
  v_identity public.claimant_identities%rowtype;
  v_portal public.claimant_portal_session_controls%rowtype;
  v_finalization public.claimant_release_package_finalizations%rowtype;
  v_package public.claimant_release_packages%rowtype;
  v_manifest public.claimant_release_signed_manifests%rowtype;
  v_package_grant public.claimant_release_package_grants%rowtype;
  v_source_grant public.claimant_recipient_grants%rowtype;
  v_device_key public.claimant_device_keys%rowtype;
  v_case_key public.claimant_case_device_keys%rowtype;
  v_existing public.claimant_release_retrieval_session_idempotency%rowtype;
  v_request_digest text;
  v_expires_at timestamptz;
  v_result jsonb;
begin
  if p_expected_case_version < 4
    or p_authenticated_at < v_authorized_at - interval '10 minutes'
    or p_authenticated_at > v_authorized_at + interval '1 minute' then
    raise exception 'Fresh claimant retrieval assurance is required.' using errcode = '28000';
  end if;

  v_request_digest := encode(extensions.digest(concat_ws('|',
    p_retrieval_session_id::text, p_claimant_user_id::text,
    p_portal_session_id::text, p_authenticated_at::text, p_case_id::text,
    p_expected_case_version::text, p_finalization_id::text, p_package_id::text,
    p_grant_id::text, p_recipient_key_id::text), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:release-retrieval-session:' || p_case_id::text, 0));

  select * into v_case from public.claimant_cases
  where id = p_case_id for update;
  select * into v_identity from public.claimant_identities
  where user_id = p_claimant_user_id for update;
  select * into v_portal from public.claimant_portal_session_controls
  where user_id = p_claimant_user_id for update;
  select * into v_finalization from public.claimant_release_package_finalizations
  where id = p_finalization_id and case_id = p_case_id;
  select * into v_package from public.claimant_release_packages
  where id = p_package_id and case_id = p_case_id;

  if v_portal.user_id is null or v_portal.status <> 'active'
    or v_portal.active_session_id <> p_portal_session_id
    or v_portal.assurance_level <> 'aal2'
    or v_portal.authenticated_at <> p_authenticated_at then
    raise exception 'Claimant portal session is inactive.' using errcode = '28000';
  end if;

  if v_case.id is null or v_case.state <> 'release_ready'
    or v_case.version <> p_expected_case_version
    or v_case.claimant_user_id <> p_claimant_user_id
    or v_identity.user_id is null or v_identity.status <> 'active'
    or not exists (select 1 from public.claimant_portal_eligibilities eligibility
      where eligibility.user_id = p_claimant_user_id
        and eligibility.status = 'eligible'
        and eligibility.source = 'synthetic_fixture')
    or v_finalization.id is null or v_finalization.package_id <> p_package_id
    or v_finalization.finalized_case_version <> p_expected_case_version
    or v_finalization.status <> 'finalized_release_ready'
    or not v_finalization.manifest_signed or v_finalization.retrieval_authorized
    or not v_finalization.synthetic_only or v_finalization.expires_at <= v_authorized_at
    or v_package.id is null or v_package.claimant_user_id <> p_claimant_user_id
    or v_package.case_version + 1 <> p_expected_case_version
    or v_package.status <> 'prepared_unsigned' or v_package.manifest_signed
    or v_package.retrieval_authorized or not v_package.synthetic_only
    or v_package.expires_at <> v_finalization.expires_at
    or exists (select 1 from public.claimant_review_interventions intervention
      where intervention.case_id = p_case_id) then
    raise exception 'Claimant release retrieval authority changed.' using errcode = '40001';
  end if;

  select manifest.* into v_manifest
  from public.claimant_release_signed_manifests manifest
  where manifest.finalization_id = p_finalization_id
    and manifest.package_id = p_package_id
    and manifest.case_id = p_case_id
    and manifest.grant_id = p_grant_id
    and manifest.synthetic_only;
  select package_grant.* into v_package_grant
  from public.claimant_release_package_grants package_grant
  where package_grant.package_id = p_package_id
    and package_grant.case_id = p_case_id
    and package_grant.grant_id = p_grant_id
    and package_grant.recipient_key_id = p_recipient_key_id;
  select * into v_source_grant from public.claimant_recipient_grants
  where id = p_grant_id for update;
  select * into v_device_key from public.claimant_device_keys
  where id = p_recipient_key_id for update;
  select * into v_case_key from public.claimant_case_device_keys
  where case_id = p_case_id and key_id = p_recipient_key_id for update;

  if v_manifest.id is null or v_manifest.signing_key_id <> v_finalization.signing_key_id
    or v_package_grant.package_id is null or not v_package_grant.synthetic_only
    or v_source_grant.id is null or v_source_grant.case_id <> p_case_id
    or v_source_grant.claimant_user_id <> p_claimant_user_id
    or v_source_grant.recipient_key_id <> p_recipient_key_id
    or v_source_grant.grant_version <> v_package_grant.grant_version
    or v_source_grant.recipient_key_version <> v_package_grant.recipient_key_version
    or v_source_grant.status <> 'active'
    or v_device_key.id is null or v_device_key.claimant_user_id <> p_claimant_user_id
    or v_device_key.key_version <> v_package_grant.recipient_key_version
    or v_device_key.status <> 'active'
    or v_case_key.case_id is null or v_case_key.claimant_user_id <> p_claimant_user_id
    or v_case_key.status <> 'active'
    or not exists (select 1 from public.claimant_release_signing_authorities authority
      join public.claimant_release_signing_keys signing_key
        on signing_key.authority_id = authority.id
      where authority.id = v_finalization.signing_authority_id
        and authority.status = 'active' and authority.synthetic_only
        and not authority.live_signing_authority
        and signing_key.id = v_finalization.signing_key_id
        and signing_key.status <> 'compromised' and signing_key.synthetic_only) then
    raise exception 'Claimant release grant authority changed.' using errcode = '40001';
  end if;

  select * into v_existing from public.claimant_release_retrieval_session_idempotency
  where operation = 'authorize_release_retrieval_session'
    and case_id = p_case_id and claimant_user_id = p_claimant_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key input changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;

  v_expires_at := least(v_authorized_at + interval '15 minutes',
    v_finalization.expires_at);
  if v_expires_at <= v_authorized_at + interval '1 minute' then
    raise exception 'Claimant release retrieval window is unavailable.' using errcode = '40001';
  end if;

  insert into public.claimant_release_retrieval_sessions (
    id, case_id, finalization_id, package_id, claimant_user_id,
    portal_session_id, portal_session_version, grant_id, recipient_key_id,
    recipient_key_version, source_case_version, authenticated_at,
    authorized_at, expires_at
  ) values (
    p_retrieval_session_id, p_case_id, p_finalization_id, p_package_id,
    p_claimant_user_id, p_portal_session_id, v_portal.version, p_grant_id,
    p_recipient_key_id, v_package_grant.recipient_key_version,
    p_expected_case_version, p_authenticated_at, v_authorized_at, v_expires_at
  );

  insert into public.claimant_release_retrieval_session_events (
    retrieval_session_id, case_id, claimant_user_id, event_type, idempotency_key
  ) values (
    p_retrieval_session_id, p_case_id, p_claimant_user_id,
    'retrieval_session_authorized', p_idempotency_key
  );

  v_result := jsonb_build_object(
    'case_id', p_case_id, 'case_version', p_expected_case_version,
    'case_state', 'release_ready', 'release_package_id', p_package_id,
    'finalization_id', p_finalization_id,
    'retrieval_session_id', p_retrieval_session_id,
    'retrieval_session_status', 'authorized_unserved',
    'retrieval_session_expires_at', v_expires_at,
    'portal_session_version', v_portal.version,
    'grant_id', p_grant_id, 'recipient_key_id', p_recipient_key_id,
    'session_authorized', true, 'package_serving_authorized', false,
    'package_served', false, 'retrieval_completed', false,
    'replayed', false
  );

  insert into public.claimant_release_retrieval_session_idempotency (
    operation, case_id, claimant_user_id, idempotency_key,
    request_digest, result
  ) values (
    'authorize_release_retrieval_session', p_case_id, p_claimant_user_id,
    p_idempotency_key, v_request_digest, v_result - 'replayed'
  );

  return v_result;
exception when unique_violation then
  raise exception 'Retrieval session conflicts with existing authority.'
    using errcode = '40001';
end
$function$;

revoke all on function public.claimant_authorize_release_retrieval_session(
  uuid, uuid, uuid, timestamptz, uuid, integer, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_authorize_release_retrieval_session(
  uuid, uuid, uuid, timestamptz, uuid, integer, uuid, uuid, uuid, uuid, uuid
) to service_role;
