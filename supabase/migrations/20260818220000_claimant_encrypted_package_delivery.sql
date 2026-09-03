do $drop_generated_checks$
declare v_column text; v_constraint name;
begin
  foreach v_column in array array['status', 'package_serving_authorized', 'package_served']
  loop
    select constraint_row.conname into strict v_constraint
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_attribute attribute_row
      on attribute_row.attrelid = constraint_row.conrelid
      and attribute_row.attnum = constraint_row.conkey[1]
    where constraint_row.conrelid =
      'public.claimant_release_retrieval_sessions'::regclass
      and constraint_row.contype = 'c'
      and pg_catalog.array_length(constraint_row.conkey, 1) = 1
      and attribute_row.attname = v_column;
    execute format('alter table public.claimant_release_retrieval_sessions drop constraint %I',
      v_constraint);
  end loop;
end $drop_generated_checks$;
alter table public.claimant_release_retrieval_sessions
add constraint claimant_release_retrieval_sessions_status_check check (
  status in ('authorized_unserved', 'delivery_prepared', 'consumed_served')
),
add constraint claimant_release_retrieval_sessions_delivery_state_check check (
  (status = 'authorized_unserved' and not package_serving_authorized and not package_served)
  or (status = 'delivery_prepared' and package_serving_authorized and not package_served)
  or (status = 'consumed_served' and package_serving_authorized and package_served)
);
grant update on table public.claimant_release_retrieval_sessions to service_role;

create table public.claimant_encrypted_package_deliveries (
  id uuid primary key,
  delivery_key text not null unique
    check (delivery_key ~ '^synthetic_package_delivery_[a-z0-9_]{1,100}$'),
  retrieval_session_id uuid not null unique,
  case_id uuid not null,
  finalization_id uuid not null,
  package_id uuid not null,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  grant_id uuid not null references public.claimant_recipient_grants(id) on delete restrict,
  recipient_key_id uuid not null references public.claimant_device_keys(id) on delete restrict,
  source_case_version integer not null check (source_case_version > 3),
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{64}$'),
  payload_bytes integer not null check (payload_bytes between 512 and 12582912),
  status text not null default 'prepared_unserved'
    check (status in ('prepared_unserved', 'served')),
  package_served boolean not null default false,
  retrieval_completed boolean not null default false check (not retrieval_completed),
  started_at timestamptz not null default now(),
  lease_expires_at timestamptz not null,
  served_at timestamptz null,
  receipt_ref text null
    check (receipt_ref is null or receipt_ref ~ '^synthetic_delivery_receipt_[a-z0-9_]{1,100}$'),
  receipt_digest text null
    check (receipt_digest is null or receipt_digest ~ '^[0-9a-f]{64}$'),
  synthetic_only boolean not null default true check (synthetic_only),
  unique (id, case_id),
  foreign key (retrieval_session_id, case_id)
    references public.claimant_release_retrieval_sessions(id, case_id) on delete restrict,
  foreign key (finalization_id, case_id)
    references public.claimant_release_package_finalizations(id, case_id) on delete restrict,
  foreign key (package_id, case_id)
    references public.claimant_release_packages(id, case_id) on delete restrict,
  check (lease_expires_at > started_at),
  check (
    (status = 'prepared_unserved' and not package_served and served_at is null
      and receipt_ref is null and receipt_digest is null)
    or (status = 'served' and package_served and served_at is not null
      and receipt_ref is not null and receipt_digest is not null)
  )
);

create table public.claimant_encrypted_package_delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null,
  case_id uuid not null,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'encrypted_package_delivery_prepared', 'encrypted_package_served'
  )),
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and metadata = '{}'::jsonb),
  unique (delivery_id, event_type),
  unique (case_id, claimant_user_id, idempotency_key, event_type),
  foreign key (delivery_id, case_id)
    references public.claimant_encrypted_package_deliveries(id, case_id) on delete restrict
);

create table public.claimant_encrypted_package_delivery_idempotency (
  operation text not null check (operation in (
    'prepare_encrypted_package_delivery', 'commit_encrypted_package_delivery'
  )),
  delivery_id uuid not null references public.claimant_encrypted_package_deliveries(id)
    on delete restrict,
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and not (result ?| array['ciphertext', 'nonce', 'canonical_manifest',
      'detached_signature', 'public_key', 'token', 'signed_url', 'delivery_payload'])
  ),
  created_at timestamptz not null default now(),
  primary key (operation, delivery_id, claimant_user_id, idempotency_key)
);

create index claimant_encrypted_package_deliveries_case_claimant_idx
on public.claimant_encrypted_package_deliveries (case_id, claimant_user_id);
create index claimant_encrypted_package_deliveries_finalization_case_idx
on public.claimant_encrypted_package_deliveries (finalization_id, case_id);
create index claimant_encrypted_package_deliveries_package_case_idx
on public.claimant_encrypted_package_deliveries (package_id, case_id);
create index claimant_encrypted_package_deliveries_claimant_status_idx
on public.claimant_encrypted_package_deliveries (claimant_user_id, status, started_at desc);
create index claimant_encrypted_package_deliveries_grant_idx
on public.claimant_encrypted_package_deliveries (grant_id);
create index claimant_encrypted_package_deliveries_key_idx
on public.claimant_encrypted_package_deliveries (recipient_key_id);
create index claimant_encrypted_package_delivery_events_claimant_idx
on public.claimant_encrypted_package_delivery_events (claimant_user_id, occurred_at desc);
create index claimant_encrypted_package_delivery_idempotency_case_idx
on public.claimant_encrypted_package_delivery_idempotency (case_id);
create index claimant_encrypted_package_delivery_idempotency_claimant_idx
on public.claimant_encrypted_package_delivery_idempotency (claimant_user_id);

revoke all on table public.claimant_encrypted_package_deliveries from public;
revoke all on table public.claimant_encrypted_package_deliveries from anon;
revoke all on table public.claimant_encrypted_package_deliveries from authenticated;
revoke all on table public.claimant_encrypted_package_delivery_events from public;
revoke all on table public.claimant_encrypted_package_delivery_events from anon;
revoke all on table public.claimant_encrypted_package_delivery_events from authenticated;
revoke all on table public.claimant_encrypted_package_delivery_idempotency from public;
revoke all on table public.claimant_encrypted_package_delivery_idempotency from anon;
revoke all on table public.claimant_encrypted_package_delivery_idempotency from authenticated;

grant select, insert, update on table public.claimant_encrypted_package_deliveries
to service_role;
grant select, insert on table public.claimant_encrypted_package_delivery_events
to service_role;
grant select, insert on table public.claimant_encrypted_package_delivery_idempotency
to service_role;

alter table public.claimant_encrypted_package_deliveries enable row level security;
alter table public.claimant_encrypted_package_deliveries force row level security;
alter table public.claimant_encrypted_package_delivery_events enable row level security;
alter table public.claimant_encrypted_package_delivery_events force row level security;
alter table public.claimant_encrypted_package_delivery_idempotency enable row level security;
alter table public.claimant_encrypted_package_delivery_idempotency force row level security;

create policy "Claimant encrypted package deliveries are server-only."
on public.claimant_encrypted_package_deliveries for all to anon, authenticated
using (false) with check (false);
create policy "Claimant encrypted package delivery events are server-only."
on public.claimant_encrypted_package_delivery_events for all to anon, authenticated
using (false) with check (false);
create policy "Claimant encrypted package delivery idempotency is server-only."
on public.claimant_encrypted_package_delivery_idempotency for all to anon, authenticated
using (false) with check (false);

create function public.claimant_prepare_encrypted_package_delivery(
  p_delivery_id uuid,
  p_delivery_key text,
  p_retrieval_session_id uuid,
  p_case_id uuid,
  p_expected_case_version integer,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_started_at timestamptz := now();
  v_case public.claimant_cases%rowtype;
  v_session public.claimant_release_retrieval_sessions%rowtype;
  v_portal public.claimant_portal_session_controls%rowtype;
  v_finalization public.claimant_release_package_finalizations%rowtype;
  v_package public.claimant_release_packages%rowtype;
  v_manifest public.claimant_release_signed_manifests%rowtype;
  v_package_grant public.claimant_release_package_grants%rowtype;
  v_source_grant public.claimant_recipient_grants%rowtype;
  v_existing public.claimant_encrypted_package_delivery_idempotency%rowtype;
  v_delivery public.claimant_encrypted_package_deliveries%rowtype;
  v_assets jsonb;
  v_payload jsonb;
  v_payload_text text;
  v_payload_digest text;
  v_payload_bytes integer;
  v_request_digest text;
  v_lease_expires_at timestamptz;
  v_result jsonb;
begin
  if p_expected_case_version < 4
    or p_delivery_key !~ '^synthetic_package_delivery_[a-z0-9_]{1,100}$' then
    raise exception 'Encrypted package delivery input is invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_delivery_id::text,
    p_delivery_key, p_retrieval_session_id::text, p_case_id::text,
    p_expected_case_version::text), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:encrypted-package-delivery:' || p_case_id::text, 0));

  select * into v_case from public.claimant_cases
  where id = p_case_id for update;
  select * into v_session from public.claimant_release_retrieval_sessions
  where id = p_retrieval_session_id and case_id = p_case_id for update;
  if v_session.id is null or v_session.source_case_version <> p_expected_case_version
    or v_session.status not in ('authorized_unserved', 'delivery_prepared', 'consumed_served')
    or v_session.retrieval_completed or v_session.expires_at <= v_started_at
    or not v_session.synthetic_only then
    raise exception 'Retrieval session is unavailable.' using errcode = '28000';
  end if;
  select * into v_portal from public.claimant_portal_session_controls
  where user_id = v_session.claimant_user_id for update;
  select * into v_finalization from public.claimant_release_package_finalizations
  where id = v_session.finalization_id and case_id = p_case_id;
  select * into v_package from public.claimant_release_packages
  where id = v_session.package_id and case_id = p_case_id;
  select * into v_manifest from public.claimant_release_signed_manifests
  where finalization_id = v_session.finalization_id
    and package_id = v_session.package_id and case_id = p_case_id
    and grant_id = v_session.grant_id;
  select * into v_package_grant from public.claimant_release_package_grants
  where package_id = v_session.package_id and case_id = p_case_id
    and grant_id = v_session.grant_id
    and recipient_key_id = v_session.recipient_key_id;
  select * into v_source_grant from public.claimant_recipient_grants
  where id = v_session.grant_id for update;

  if v_case.id is null
    or not (
      (v_session.status in ('authorized_unserved', 'delivery_prepared')
        and v_case.state = 'release_ready' and v_case.version = p_expected_case_version)
      or (v_session.status = 'consumed_served' and v_session.package_served
        and v_case.state = 'released' and v_case.version = p_expected_case_version + 1)
    )
    or v_case.claimant_user_id <> v_session.claimant_user_id
    or v_portal.user_id is null or v_portal.status <> 'active'
    or v_portal.active_session_id <> v_session.portal_session_id
    or v_portal.version <> v_session.portal_session_version
    or v_portal.assurance_level <> 'aal2'
    or not exists (select 1 from public.claimant_identities identity
      where identity.user_id = v_session.claimant_user_id and identity.status = 'active')
    or not exists (select 1 from public.claimant_portal_eligibilities eligibility
      where eligibility.user_id = v_session.claimant_user_id
        and eligibility.status = 'eligible' and eligibility.source = 'synthetic_fixture')
    or v_finalization.id is null or v_finalization.package_id <> v_session.package_id
    or v_finalization.finalized_case_version <> p_expected_case_version
    or v_finalization.status <> 'finalized_release_ready'
    or not v_finalization.manifest_signed or v_finalization.retrieval_authorized
    or v_finalization.expires_at <= v_started_at or not v_finalization.synthetic_only
    or v_package.id is null or v_package.claimant_user_id <> v_session.claimant_user_id
    or v_package.case_version + 1 <> p_expected_case_version
    or v_package.status <> 'prepared_unsigned' or v_package.manifest_signed
    or v_package.retrieval_authorized or not v_package.synthetic_only
    or v_manifest.id is null or not v_manifest.synthetic_only
    or v_manifest.signing_key_id <> v_finalization.signing_key_id
    or v_package_grant.package_id is null or not v_package_grant.synthetic_only
    or v_package_grant.recipient_key_version <> v_session.recipient_key_version
    or v_source_grant.id is null or v_source_grant.status <> 'active'
    or v_source_grant.case_id <> p_case_id
    or v_source_grant.claimant_user_id <> v_session.claimant_user_id
    or v_source_grant.recipient_key_id <> v_session.recipient_key_id
    or v_source_grant.recipient_key_version <> v_session.recipient_key_version
    or v_source_grant.grant_version <> v_package_grant.grant_version
    or not exists (select 1 from public.claimant_case_device_keys case_key
      join public.claimant_device_keys device_key on device_key.id = case_key.key_id
        and device_key.claimant_user_id = case_key.claimant_user_id
      where case_key.case_id = p_case_id and case_key.key_id = v_session.recipient_key_id
        and case_key.claimant_user_id = v_session.claimant_user_id
        and case_key.status = 'active' and device_key.status = 'active'
        and device_key.key_version = v_session.recipient_key_version)
    or not exists (select 1 from public.claimant_release_signing_authorities authority
      join public.claimant_release_signing_keys signing_key
        on signing_key.authority_id = authority.id
      where authority.id = v_finalization.signing_authority_id
        and authority.status = 'active' and authority.synthetic_only
        and not authority.live_signing_authority
        and signing_key.id = v_finalization.signing_key_id
        and signing_key.status <> 'compromised' and signing_key.synthetic_only)
    or exists (select 1 from public.claimant_review_interventions intervention
      where intervention.case_id = p_case_id) then
    raise exception 'Encrypted package delivery authority changed.' using errcode = '40001';
  end if;

  select jsonb_agg(jsonb_build_object(
    'ordinal', asset.ordinal, 'source_asset_id', asset.source_asset_id,
    'asset_type', asset.asset_type, 'ciphertext', asset.ciphertext,
    'nonce', asset.nonce, 'ciphertext_digest', asset.ciphertext_digest
  ) order by asset.ordinal) into v_assets
  from public.claimant_release_package_assets asset
  where asset.package_id = v_session.package_id and asset.case_id = p_case_id
    and asset.synthetic_only;
  if jsonb_array_length(coalesce(v_assets, '[]'::jsonb)) <> v_package.asset_count then
    raise exception 'Encrypted package asset snapshot changed.' using errcode = '40001';
  end if;

  v_payload := jsonb_build_object(
    'protocol', 'sanduqkin:claim:encrypted-delivery:v1',
    'case_id', p_case_id, 'release_package_id', v_session.package_id,
    'finalization_id', v_session.finalization_id,
    'retrieval_session_id', v_session.id, 'assets', v_assets,
    'release_material', jsonb_build_object(
      'grant_id', v_source_grant.id, 'grant_version', v_source_grant.grant_version,
      'recipient_key_id', v_source_grant.recipient_key_id,
      'recipient_key_version', v_source_grant.recipient_key_version,
      'protocol', v_source_grant.protocol, 'profile', v_source_grant.profile,
      'key_agreement', v_source_grant.key_agreement, 'kdf', v_source_grant.kdf,
      'aead', v_source_grant.aead,
      'owner_ephemeral_public_key', v_source_grant.owner_ephemeral_public_key,
      'nonce', v_source_grant.nonce, 'ciphertext', v_source_grant.ciphertext
    ),
    'signed_manifest', jsonb_build_object(
      'canonical_manifest', v_manifest.canonical_manifest,
      'manifest_digest', v_manifest.manifest_digest,
      'detached_signature', v_manifest.detached_signature,
      'signature_algorithm', v_manifest.signature_algorithm
    )
  );
  v_payload_text := v_payload::text;
  v_payload_digest := encode(extensions.digest(v_payload_text, 'sha256'), 'hex');
  v_payload_bytes := octet_length(v_payload_text);
  if v_payload_bytes not between 512 and 12582912 then
    raise exception 'Encrypted package delivery payload is unsafe.' using errcode = '54000';
  end if;
  v_lease_expires_at := least(v_started_at + interval '2 minutes', v_session.expires_at);
  if v_lease_expires_at <= v_started_at + interval '30 seconds' then
    raise exception 'Retrieval session has insufficient delivery time.' using errcode = '28000';
  end if;

  select * into v_existing from public.claimant_encrypted_package_delivery_idempotency
  where operation = 'prepare_encrypted_package_delivery'
    and delivery_id = p_delivery_id and claimant_user_id = v_session.claimant_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key input changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('delivery_payload', v_payload_text,
      'replayed', true);
  end if;
  if v_session.status <> 'authorized_unserved' then
    raise exception 'Retrieval session already has delivery authority.' using errcode = '40001';
  end if;

  insert into public.claimant_encrypted_package_deliveries (
    id, delivery_key, retrieval_session_id, case_id, finalization_id, package_id,
    claimant_user_id, grant_id, recipient_key_id, source_case_version,
    payload_digest, payload_bytes, started_at, lease_expires_at
  ) values (
    p_delivery_id, p_delivery_key, v_session.id, p_case_id, v_session.finalization_id,
    v_session.package_id, v_session.claimant_user_id, v_session.grant_id,
    v_session.recipient_key_id, p_expected_case_version, v_payload_digest,
    v_payload_bytes, v_started_at, v_lease_expires_at
  ) returning * into v_delivery;
  update public.claimant_release_retrieval_sessions set
    status = 'delivery_prepared', package_serving_authorized = true
  where id = v_session.id and status = 'authorized_unserved';
  if not found then
    raise exception 'Retrieval session changed during delivery preparation.'
      using errcode = '40001';
  end if;
  insert into public.claimant_encrypted_package_delivery_events (
    delivery_id, case_id, claimant_user_id, event_type, idempotency_key
  ) values (p_delivery_id, p_case_id, v_session.claimant_user_id,
    'encrypted_package_delivery_prepared', p_idempotency_key);
  v_result := jsonb_build_object(
    'delivery_id', p_delivery_id, 'delivery_key', p_delivery_key,
    'case_id', p_case_id, 'case_version', p_expected_case_version,
    'case_state', 'release_ready', 'retrieval_session_id', v_session.id,
    'release_package_id', v_session.package_id,
    'finalization_id', v_session.finalization_id, 'grant_id', v_session.grant_id,
    'recipient_key_id', v_session.recipient_key_id,
    'payload_digest', v_payload_digest, 'payload_bytes', v_payload_bytes,
    'lease_expires_at', v_lease_expires_at, 'delivery_status', 'prepared_unserved',
    'package_served', false, 'retrieval_completed', false, 'replayed', false
  );
  insert into public.claimant_encrypted_package_delivery_idempotency (
    operation, delivery_id, case_id, claimant_user_id, idempotency_key,
    request_digest, result
  ) values ('prepare_encrypted_package_delivery', p_delivery_id, p_case_id,
    v_session.claimant_user_id, p_idempotency_key, v_request_digest,
    v_result - 'replayed');
  return v_result || jsonb_build_object('delivery_payload', v_payload_text);
exception when unique_violation then
  raise exception 'Encrypted package delivery conflicts with existing authority.'
    using errcode = '40001';
end
$function$;

create function public.claimant_commit_encrypted_package_delivery(
  p_delivery_id uuid,
  p_delivery_key text,
  p_payload_digest text,
  p_payload_bytes integer,
  p_completed_at timestamptz,
  p_receipt_ref text,
  p_receipt_digest text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_delivery public.claimant_encrypted_package_deliveries%rowtype;
  v_session public.claimant_release_retrieval_sessions%rowtype;
  v_case public.claimant_cases%rowtype;
  v_existing public.claimant_encrypted_package_delivery_idempotency%rowtype;
  v_expected_receipt_digest text;
  v_request_digest text;
  v_first_delivery boolean := false;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:encrypted-package-delivery:' || p_delivery_id::text, 0));
  select * into v_delivery from public.claimant_encrypted_package_deliveries
  where id = p_delivery_id for update;
  if v_delivery.id is null or v_delivery.delivery_key <> p_delivery_key
    or v_delivery.payload_digest <> p_payload_digest
    or v_delivery.payload_bytes <> p_payload_bytes or not v_delivery.synthetic_only then
    raise exception 'Encrypted package delivery receipt is invalid.' using errcode = '40001';
  end if;
  select * into v_session from public.claimant_release_retrieval_sessions
  where id = v_delivery.retrieval_session_id and case_id = v_delivery.case_id for update;
  select * into v_case from public.claimant_cases
  where id = v_delivery.case_id for update;
  v_expected_receipt_digest := encode(extensions.digest(concat_ws('|',
    'sanduqkin:claim:encrypted-delivery-receipt:v1', p_delivery_key,
    p_payload_digest, p_payload_bytes::text,
    to_char(p_completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    p_receipt_ref), 'sha256'), 'hex');
  v_request_digest := encode(extensions.digest(concat_ws('|', p_delivery_id::text,
    p_delivery_key, p_payload_digest, p_payload_bytes::text,
    to_char(p_completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    p_receipt_ref, p_receipt_digest), 'sha256'), 'hex');
  select * into v_existing from public.claimant_encrypted_package_delivery_idempotency
  where operation = 'commit_encrypted_package_delivery'
    and delivery_id = p_delivery_id
    and claimant_user_id = v_delivery.claimant_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key input changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  if v_delivery.status <> 'prepared_unserved' or v_delivery.package_served
    or v_session.id is null or v_session.status <> 'delivery_prepared'
    or not v_session.package_serving_authorized or v_session.package_served
    or v_session.retrieval_completed
    or p_completed_at < v_delivery.started_at - interval '1 second'
    or p_completed_at > v_delivery.lease_expires_at
    or p_completed_at > v_session.expires_at
    or p_completed_at > now() + interval '1 minute'
    or p_receipt_ref !~ '^synthetic_delivery_receipt_[a-z0-9_]{1,100}$'
    or p_receipt_digest <> v_expected_receipt_digest then
    raise exception 'Complete encrypted package delivery was not verified.' using errcode = '40001';
  end if;
  if v_case.id is null or v_case.claimant_user_id <> v_delivery.claimant_user_id
    or not ((v_case.state = 'release_ready'
        and v_case.version = v_delivery.source_case_version)
      or (v_case.state = 'released'
        and v_case.version = v_delivery.source_case_version + 1)) then
    raise exception 'Encrypted package delivery case changed.' using errcode = '40001';
  end if;
  if v_case.state = 'release_ready' then
    update public.claimant_cases set state = 'released', version = version + 1,
      updated_at = p_completed_at
    where id = v_case.id and state = 'release_ready'
      and version = v_delivery.source_case_version;
    if not found then
      raise exception 'Encrypted package delivery case changed.' using errcode = '40001';
    end if;
    v_first_delivery := true;
  end if;
  update public.claimant_encrypted_package_deliveries set
    status = 'served', package_served = true, served_at = p_completed_at,
    receipt_ref = p_receipt_ref, receipt_digest = p_receipt_digest
  where id = p_delivery_id and status = 'prepared_unserved';
  update public.claimant_release_retrieval_sessions set
    status = 'consumed_served', package_served = true
  where id = v_session.id and status = 'delivery_prepared';
  insert into public.claimant_encrypted_package_delivery_events (
    delivery_id, case_id, claimant_user_id, event_type, idempotency_key,
    occurred_at
  ) values (p_delivery_id, v_delivery.case_id, v_delivery.claimant_user_id,
    'encrypted_package_served', p_idempotency_key, p_completed_at);
  v_result := jsonb_build_object(
    'delivery_id', p_delivery_id, 'delivery_key', p_delivery_key,
    'case_id', v_delivery.case_id,
    'case_version', v_delivery.source_case_version + 1,
    'case_state', 'released', 'retrieval_session_id', v_session.id,
    'release_package_id', v_delivery.package_id,
    'delivery_status', 'served', 'package_served', true,
    'first_successful_delivery', v_first_delivery,
    'retrieval_completed', false, 'served_at', p_completed_at,
    'receipt_ref', p_receipt_ref, 'replayed', false
  );
  insert into public.claimant_encrypted_package_delivery_idempotency (
    operation, delivery_id, case_id, claimant_user_id, idempotency_key,
    request_digest, result
  ) values ('commit_encrypted_package_delivery', p_delivery_id,
    v_delivery.case_id, v_delivery.claimant_user_id, p_idempotency_key,
    v_request_digest, v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Encrypted package delivery conflicts with existing completion.'
    using errcode = '40001';
end
$function$;

revoke all on function public.claimant_prepare_encrypted_package_delivery(
  uuid, text, uuid, uuid, integer, uuid
) from public, anon, authenticated;
revoke all on function public.claimant_commit_encrypted_package_delivery(
  uuid, text, text, integer, timestamptz, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_prepare_encrypted_package_delivery(
  uuid, text, uuid, uuid, integer, uuid
) to service_role;
grant execute on function public.claimant_commit_encrypted_package_delivery(
  uuid, text, text, integer, timestamptz, text, text, uuid
) to service_role;
