create table public.claimant_release_packages (
  id uuid primary key,
  package_ref text not null unique
    check (package_ref ~ '^synthetic_release_package_[a-z0-9_]{1,100}$'),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  release_authorization_id uuid not null,
  cycle_id uuid not null,
  review_round_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  claimant_user_id uuid not null references public.claimant_identities(user_id) on delete restrict,
  case_version integer not null check (case_version > 2),
  release_authorization_version integer not null default 1
    check (release_authorization_version = 1),
  protocol text not null default 'sanduqkin:claim:release-package-preparation:v1'
    check (protocol = 'sanduqkin:claim:release-package-preparation:v1'),
  route_profile text not null default 'registered_recipient_v1'
    check (route_profile = 'registered_recipient_v1'),
  release_material_profile text not null default 'registered_recipient_v2'
    check (release_material_profile = 'registered_recipient_v2'),
  asset_count integer not null check (asset_count between 1 and 100),
  grant_count integer not null check (grant_count between 2 and 10),
  asset_snapshot_boundary timestamptz not null,
  preparation_manifest_digest text not null check (preparation_manifest_digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'prepared_unsigned' check (status = 'prepared_unsigned'),
  manifest_signed boolean not null default false check (not manifest_signed),
  retrieval_authorized boolean not null default false check (not retrieval_authorized),
  synthetic_only boolean not null default true check (synthetic_only),
  prepared_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (asset_snapshot_boundary <= prepared_at),
  check (expires_at = prepared_at + interval '72 hours'),
  unique (case_id),
  unique (release_authorization_id),
  unique (id, case_id),
  foreign key (release_authorization_id, case_id)
    references public.claimant_release_authorizations(id, case_id) on delete restrict,
  foreign key (cycle_id, case_id)
    references public.claimant_owner_protection_cycles(id, case_id) on delete restrict,
  foreign key (review_round_id, case_id)
    references public.claimant_review_rounds(id, case_id) on delete restrict
);

create table public.claimant_release_package_assets (
  package_id uuid not null,
  case_id uuid not null,
  ordinal integer not null check (ordinal between 1 and 100),
  source_asset_id uuid not null references public.vault_assets(id) on delete restrict,
  asset_type text not null check (length(asset_type) between 1 and 100),
  source_updated_at timestamptz not null,
  ciphertext text not null check (
    length(ciphertext) between 16 and 1048576 and ciphertext ~ '^[A-Za-z0-9_-]+$'
  ),
  nonce text not null check (
    length(nonce) between 16 and 256 and nonce ~ '^[A-Za-z0-9_-]+$'
  ),
  ciphertext_digest text not null check (ciphertext_digest ~ '^[0-9a-f]{64}$'),
  synthetic_only boolean not null default true check (synthetic_only),
  primary key (package_id, ordinal),
  unique (package_id, source_asset_id),
  foreign key (package_id, case_id)
    references public.claimant_release_packages(id, case_id) on delete restrict
);

create table public.claimant_release_package_grants (
  package_id uuid not null,
  case_id uuid not null,
  ordinal integer not null check (ordinal between 1 and 10),
  grant_id uuid not null references public.claimant_recipient_grants(id) on delete restrict,
  grant_version integer not null check (grant_version > 0),
  recipient_key_id uuid not null references public.claimant_device_keys(id) on delete restrict,
  recipient_key_version integer not null check (recipient_key_version > 0),
  sealed_grant_digest text not null check (sealed_grant_digest ~ '^[0-9a-f]{64}$'),
  synthetic_only boolean not null default true check (synthetic_only),
  primary key (package_id, ordinal),
  unique (package_id, grant_id),
  unique (package_id, recipient_key_id),
  foreign key (package_id, case_id)
    references public.claimant_release_packages(id, case_id) on delete restrict
);

create table public.claimant_release_package_events (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null,
  case_id uuid not null,
  event_type text not null check (event_type = 'encrypted_package_prepared'),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and metadata = '{}'::jsonb),
  unique (case_id, idempotency_key, event_type),
  foreign key (package_id, case_id)
    references public.claimant_release_packages(id, case_id) on delete restrict
);

create table public.claimant_release_package_idempotency (
  operation text not null check (operation = 'prepare_encrypted_release_package'),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (operation, case_id, owner_user_id, idempotency_key)
);

create index claimant_release_packages_owner_idx
on public.claimant_release_packages (owner_user_id);
create index claimant_release_packages_claimant_idx
on public.claimant_release_packages (claimant_user_id);
create index claimant_release_packages_cycle_case_idx
on public.claimant_release_packages (cycle_id, case_id);
create index claimant_release_packages_round_case_idx
on public.claimant_release_packages (review_round_id, case_id);
create index claimant_release_package_assets_source_idx
on public.claimant_release_package_assets (source_asset_id);
create index claimant_release_package_grants_grant_idx
on public.claimant_release_package_grants (grant_id);
create index claimant_release_package_grants_key_idx
on public.claimant_release_package_grants (recipient_key_id);
create index claimant_release_package_events_actor_idx
on public.claimant_release_package_events (actor_user_id);
create index claimant_release_package_idempotency_owner_idx
on public.claimant_release_package_idempotency (owner_user_id);

revoke all on table public.claimant_release_packages from public;
revoke all on table public.claimant_release_packages from anon;
revoke all on table public.claimant_release_packages from authenticated;
revoke all on table public.claimant_release_package_assets from public;
revoke all on table public.claimant_release_package_assets from anon;
revoke all on table public.claimant_release_package_assets from authenticated;
revoke all on table public.claimant_release_package_grants from public;
revoke all on table public.claimant_release_package_grants from anon;
revoke all on table public.claimant_release_package_grants from authenticated;
revoke all on table public.claimant_release_package_events from public;
revoke all on table public.claimant_release_package_events from anon;
revoke all on table public.claimant_release_package_events from authenticated;
revoke all on table public.claimant_release_package_idempotency from public;
revoke all on table public.claimant_release_package_idempotency from anon;
revoke all on table public.claimant_release_package_idempotency from authenticated;
grant select, insert on table public.claimant_release_packages to service_role;
grant select, insert on table public.claimant_release_package_assets to service_role;
grant select, insert on table public.claimant_release_package_grants to service_role;
grant select, insert on table public.claimant_release_package_events to service_role;
grant select, insert on table public.claimant_release_package_idempotency to service_role;

alter table public.claimant_release_packages enable row level security;
alter table public.claimant_release_packages force row level security;
alter table public.claimant_release_package_assets enable row level security;
alter table public.claimant_release_package_assets force row level security;
alter table public.claimant_release_package_grants enable row level security;
alter table public.claimant_release_package_grants force row level security;
alter table public.claimant_release_package_events enable row level security;
alter table public.claimant_release_package_events force row level security;
alter table public.claimant_release_package_idempotency enable row level security;
alter table public.claimant_release_package_idempotency force row level security;
create policy "Claimant release packages are server-only."
on public.claimant_release_packages for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release package assets are server-only."
on public.claimant_release_package_assets for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release package grants are server-only."
on public.claimant_release_package_grants for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release package events are server-only."
on public.claimant_release_package_events for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release package idempotency is server-only."
on public.claimant_release_package_idempotency for all to anon, authenticated
using (false) with check (false);

create function public.claimant_prepare_encrypted_release_package(
  p_owner_user_id uuid, p_case_id uuid, p_release_authorization_id uuid,
  p_cycle_id uuid, p_review_round_id uuid, p_expected_case_version integer,
  p_package_id uuid, p_package_ref text, p_assets jsonb, p_grants jsonb,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_authorization public.claimant_release_authorizations%rowtype;
  v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_round public.claimant_review_rounds%rowtype;
  v_authority public.claimant_release_authority_identities%rowtype;
  v_asset public.vault_assets%rowtype;
  v_grant public.claimant_recipient_grants%rowtype;
  v_existing public.claimant_release_package_idempotency%rowtype;
  v_package public.claimant_release_packages%rowtype;
  v_entry record; v_request_digest text; v_asset_digest text; v_grant_digest text;
  v_asset_manifest text := ''; v_grant_manifest text := ''; v_manifest_digest text;
  v_asset_ids uuid[] := array[]::uuid[]; v_grant_ids uuid[] := array[]::uuid[];
  v_asset_count integer; v_grant_count integer; v_active_grant_count integer;
  v_total_ciphertext_length bigint := 0; v_snapshot_boundary timestamptz;
  v_prepared_at timestamptz := now(); v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:encrypted-release-package:' || p_case_id::text, 0));
  if p_expected_case_version < 3
    or p_package_ref !~ '^synthetic_release_package_[a-z0-9_]{1,100}$'
    or jsonb_typeof(p_assets) <> 'array' or jsonb_typeof(p_grants) <> 'array' then
    raise exception 'Encrypted package input is invalid.' using errcode = '22023';
  end if;
  v_asset_count := jsonb_array_length(p_assets);
  v_grant_count := jsonb_array_length(p_grants);
  if v_asset_count not between 1 and 100 or v_grant_count not between 2 and 10 then
    raise exception 'Encrypted package bounds are invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_owner_user_id::text,
    p_case_id::text, p_release_authorization_id::text, p_cycle_id::text,
    p_review_round_id::text, p_expected_case_version::text, p_package_id::text,
    p_package_ref, p_assets::text, p_grants::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_release_package_idempotency
  where operation = 'prepare_encrypted_release_package' and case_id = p_case_id
    and owner_user_id = p_owner_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was used with different package input.'
        using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_cycle from public.claimant_owner_protection_cycles
  where id = p_cycle_id and case_id = p_case_id for update;
  select * into v_round from public.claimant_review_rounds
  where id = p_review_round_id and case_id = p_case_id for update;
  select * into v_authorization from public.claimant_release_authorizations
  -- Authorization records are append-only; mutable authority is locked above/below.
  where id = p_release_authorization_id and case_id = p_case_id;
  select * into v_authority from public.claimant_release_authority_identities
  where id = v_authorization.authority_identity_id for update;
  if v_case.id is null or v_case.owner_user_id <> p_owner_user_id
    or v_case.state <> 'approved' or v_case.version <> p_expected_case_version
    or v_case.route_profile <> 'registered_recipient_v1'
    or v_authorization.id is null
    or v_authorization.authorized_case_version <> p_expected_case_version
    or v_authorization.cycle_id <> p_cycle_id
    or v_authorization.review_round_id <> p_review_round_id
    or v_authorization.status <> 'authorized' or not v_authorization.release_authorized
    or v_authorization.package_creation_authorized or v_authorization.retrieval_authorized
    or v_authorization.policy_pack_id <> v_case.policy_pack_id
    or v_authorization.policy_pack_version <> v_case.policy_pack_version
    or v_cycle.id is null or v_cycle.status <> 'delivery_verified'
    or v_cycle.cooldown_expires_at is null or v_cycle.cooldown_expires_at > v_prepared_at
    or v_cycle.owner_user_id <> v_case.owner_user_id
    or v_cycle.claimant_user_id <> v_case.claimant_user_id
    or v_round.id is null or v_round.status <> 'two_person_approved'
    or not v_round.two_person_approval_satisfied or v_round.release_authorized
    or v_round.round_version <> v_authorization.review_round_version
    or v_authority.id is null or v_authority.status <> 'active'
    or not v_authority.synthetic_only or v_authority.live_release_authority
    or exists (select 1 from public.claimant_review_interventions intervention
      where intervention.case_id = p_case_id) then
    raise exception 'Encrypted package authority changed.' using errcode = '42501';
  end if;
  select count(*) into v_active_grant_count
  from public.claimant_recipient_grants grant_record
  join public.claimant_case_device_keys case_key
    on case_key.case_id = grant_record.case_id
      and case_key.key_id = grant_record.recipient_key_id
      and case_key.claimant_user_id = grant_record.claimant_user_id
  join public.claimant_device_keys device_key
    on device_key.id = case_key.key_id
      and device_key.claimant_user_id = case_key.claimant_user_id
  where grant_record.case_id = p_case_id and grant_record.status = 'active'
    and grant_record.owner_user_id = p_owner_user_id
    and grant_record.claimant_user_id = v_case.claimant_user_id
    and case_key.status = 'active' and device_key.status = 'active'
    and grant_record.recipient_key_version = device_key.key_version;
  if v_active_grant_count <> v_grant_count then
    raise exception 'Encrypted package grant set changed.' using errcode = '40001';
  end if;
  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_assets) with ordinality loop
    if jsonb_typeof(v_entry.value) <> 'object'
      or (select count(*) from jsonb_object_keys(v_entry.value)) <> 5
      or not (v_entry.value ?& array['asset_id', 'asset_type', 'ciphertext',
        'nonce', 'ciphertext_digest']) then
      raise exception 'Encrypted package asset input is invalid.' using errcode = '22023';
    end if;
    if (v_entry.value ->> 'asset_id')::uuid = any(v_asset_ids) then
      raise exception 'Encrypted package asset is duplicated.' using errcode = '22023';
    end if;
    v_asset_ids := array_append(v_asset_ids, (v_entry.value ->> 'asset_id')::uuid);
    select * into v_asset from public.vault_assets
    where id = (v_entry.value ->> 'asset_id')::uuid
      and user_id = p_owner_user_id and deleted_at is null for update;
    v_asset_digest := encode(extensions.digest(concat_ws('|', v_asset.id::text,
      v_asset.asset_type, v_asset.ciphertext, v_asset.nonce), 'sha256'), 'hex');
    if v_asset.id is null or v_asset.updated_at > v_prepared_at
      or v_asset.asset_type <> v_entry.value ->> 'asset_type'
      or v_asset.ciphertext <> v_entry.value ->> 'ciphertext'
      or v_asset.nonce <> v_entry.value ->> 'nonce'
      or v_asset_digest <> v_entry.value ->> 'ciphertext_digest'
      or length(v_asset.ciphertext) not between 16 and 1048576
      or v_asset.ciphertext !~ '^[A-Za-z0-9_-]+$'
      or length(v_asset.nonce) not between 16 and 256
      or v_asset.nonce !~ '^[A-Za-z0-9_-]+$' then
      raise exception 'Encrypted package asset authority changed.' using errcode = '40001';
    end if;
    v_total_ciphertext_length := v_total_ciphertext_length + length(v_asset.ciphertext);
    v_snapshot_boundary := greatest(v_snapshot_boundary, v_asset.updated_at);
    v_asset_manifest := v_asset_manifest || concat_ws(':', v_entry.ordinal::text,
      v_asset.id::text, v_asset_digest) || '|';
  end loop;
  if v_total_ciphertext_length > 10485760 then
    raise exception 'Encrypted package ciphertext total is too large.' using errcode = '22023';
  end if;
  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_grants) with ordinality loop
    if jsonb_typeof(v_entry.value) <> 'object'
      or (select count(*) from jsonb_object_keys(v_entry.value)) <> 5
      or not (v_entry.value ?& array['grant_id', 'grant_version', 'recipient_key_id',
        'recipient_key_version', 'sealed_grant_digest']) then
      raise exception 'Encrypted package grant input is invalid.' using errcode = '22023';
    end if;
    if (v_entry.value ->> 'grant_id')::uuid = any(v_grant_ids) then
      raise exception 'Encrypted package grant is duplicated.' using errcode = '22023';
    end if;
    v_grant_ids := array_append(v_grant_ids, (v_entry.value ->> 'grant_id')::uuid);
    select grant_record.* into v_grant
    from public.claimant_recipient_grants grant_record
    join public.claimant_case_device_keys case_key
      on case_key.case_id = grant_record.case_id
        and case_key.key_id = grant_record.recipient_key_id
    join public.claimant_device_keys device_key
      on device_key.id = case_key.key_id
        and device_key.claimant_user_id = case_key.claimant_user_id
    where grant_record.id = (v_entry.value ->> 'grant_id')::uuid
      and grant_record.case_id = p_case_id and grant_record.status = 'active'
      and grant_record.owner_user_id = p_owner_user_id
      and grant_record.claimant_user_id = v_case.claimant_user_id
      and case_key.status = 'active' and device_key.status = 'active'
      and grant_record.recipient_key_version = device_key.key_version for update of grant_record;
    v_grant_digest := encode(extensions.digest(concat_ws('|', v_grant.id::text,
      v_grant.grant_version::text, v_grant.recipient_key_id::text,
      v_grant.recipient_key_version::text, v_grant.protocol, v_grant.profile,
      v_grant.key_agreement, v_grant.kdf, v_grant.aead,
      v_grant.owner_ephemeral_public_key, v_grant.nonce, v_grant.ciphertext),
      'sha256'), 'hex');
    if v_grant.id is null
      or v_grant.grant_version <> (v_entry.value ->> 'grant_version')::integer
      or v_grant.recipient_key_id <> (v_entry.value ->> 'recipient_key_id')::uuid
      or v_grant.recipient_key_version <>
        (v_entry.value ->> 'recipient_key_version')::integer
      or v_grant_digest <> v_entry.value ->> 'sealed_grant_digest' then
      raise exception 'Encrypted package grant authority changed.' using errcode = '40001';
    end if;
    v_grant_manifest := v_grant_manifest || concat_ws(':', v_entry.ordinal::text,
      v_grant.id::text, v_grant_digest) || '|';
  end loop;
  v_manifest_digest := encode(extensions.digest(concat_ws('|',
    'sanduqkin:claim:release-package-preparation:v1', p_package_id::text,
    p_case_id::text, p_expected_case_version::text, p_release_authorization_id::text,
    p_cycle_id::text, p_review_round_id::text, v_asset_manifest, v_grant_manifest),
    'sha256'), 'hex');
  insert into public.claimant_release_packages (id, package_ref, case_id,
    release_authorization_id, cycle_id, review_round_id, owner_user_id, claimant_user_id,
    case_version, asset_count, grant_count, asset_snapshot_boundary,
    preparation_manifest_digest, prepared_at, expires_at)
  values (p_package_id, p_package_ref, p_case_id, p_release_authorization_id,
    p_cycle_id, p_review_round_id, p_owner_user_id, v_case.claimant_user_id,
    p_expected_case_version, v_asset_count, v_grant_count, v_snapshot_boundary,
    v_manifest_digest, v_prepared_at, v_prepared_at + interval '72 hours')
  returning * into v_package;
  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_assets) with ordinality loop
    select * into v_asset from public.vault_assets
    where id = (v_entry.value ->> 'asset_id')::uuid and user_id = p_owner_user_id;
    v_asset_digest := encode(extensions.digest(concat_ws('|', v_asset.id::text,
      v_asset.asset_type, v_asset.ciphertext, v_asset.nonce), 'sha256'), 'hex');
    insert into public.claimant_release_package_assets (package_id, case_id, ordinal,
      source_asset_id, asset_type, source_updated_at, ciphertext, nonce, ciphertext_digest)
    values (p_package_id, p_case_id, v_entry.ordinal, v_asset.id, v_asset.asset_type,
      v_asset.updated_at, v_asset.ciphertext, v_asset.nonce, v_asset_digest);
  end loop;
  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_grants) with ordinality loop
    select * into v_grant from public.claimant_recipient_grants
    where id = (v_entry.value ->> 'grant_id')::uuid;
    insert into public.claimant_release_package_grants (package_id, case_id, ordinal,
      grant_id, grant_version, recipient_key_id, recipient_key_version,
      sealed_grant_digest)
    values (p_package_id, p_case_id, v_entry.ordinal, v_grant.id,
      v_grant.grant_version, v_grant.recipient_key_id, v_grant.recipient_key_version,
      v_entry.value ->> 'sealed_grant_digest');
  end loop;
  insert into public.claimant_release_package_events (package_id, case_id, event_type,
    actor_user_id, idempotency_key)
  values (p_package_id, p_case_id, 'encrypted_package_prepared',
    p_owner_user_id, p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id,
    'case_version', v_case.version, 'case_state', v_case.state,
    'release_authorization_id', p_release_authorization_id,
    'release_package_id', v_package.id, 'package_status', v_package.status,
    'asset_count', v_package.asset_count, 'grant_count', v_package.grant_count,
    'manifest_signed', false, 'retrieval_authorized', false,
    'replayed', false);
  insert into public.claimant_release_package_idempotency (operation, case_id,
    owner_user_id, idempotency_key, request_digest, result)
  values ('prepare_encrypted_release_package', p_case_id, p_owner_user_id,
    p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Encrypted package conflicts with existing authority.'
    using errcode = '40001';
end $function$;

revoke all on function public.claimant_prepare_encrypted_release_package(
  uuid, uuid, uuid, uuid, uuid, integer, uuid, text, jsonb, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_prepare_encrypted_release_package(
  uuid, uuid, uuid, uuid, uuid, integer, uuid, text, jsonb, jsonb, uuid
) to service_role;
