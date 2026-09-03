create table public.claimant_release_signing_authorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  pseudonymous_ref text not null unique
    check (pseudonymous_ref ~ '^synthetic_release_signer_[a-z0-9_]{1,100}$'),
  authority_class text not null default 'release_manifest_test_signer'
    check (authority_class = 'release_manifest_test_signer'),
  status text not null default 'active' check (status in ('active', 'suspended', 'retired')),
  synthetic_only boolean not null default true check (synthetic_only),
  live_signing_authority boolean not null default false check (not live_signing_authority),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at)
);

create table public.claimant_release_signing_keys (
  id uuid primary key default gen_random_uuid(),
  authority_id uuid not null
    references public.claimant_release_signing_authorities(id) on delete restrict,
  signing_key_id text not null
    check (signing_key_id ~ '^claim-release-signing-synthetic-[a-z0-9-]{1,100}$'),
  key_version integer not null check (key_version > 0),
  signature_algorithm text not null default 'ed25519' check (signature_algorithm = 'ed25519'),
  public_key text not null check (
    length(public_key) = 43 and public_key ~ '^[A-Za-z0-9_-]+$'
  ),
  public_key_digest text not null check (public_key_digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active', 'retired', 'compromised')),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  synthetic_only boolean not null default true check (synthetic_only),
  created_at timestamptz not null default now(),
  check (valid_until > valid_from),
  unique (signing_key_id, key_version),
  unique (id, authority_id)
);

create table public.claimant_release_package_finalizations (
  id uuid primary key,
  package_id uuid not null,
  case_id uuid not null,
  release_authorization_id uuid not null,
  signing_authority_id uuid not null
    references public.claimant_release_signing_authorities(id) on delete restrict,
  signing_key_id uuid not null,
  source_case_version integer not null check (source_case_version > 2),
  finalized_case_version integer not null check (finalized_case_version = source_case_version + 1),
  preparation_manifest_digest text not null
    check (preparation_manifest_digest ~ '^[0-9a-f]{64}$'),
  signed_manifest_set_digest text not null
    check (signed_manifest_set_digest ~ '^[0-9a-f]{64}$'),
  manifest_count integer not null check (manifest_count between 2 and 10),
  status text not null default 'finalized_release_ready'
    check (status = 'finalized_release_ready'),
  manifest_signed boolean not null default true check (manifest_signed),
  retrieval_authorized boolean not null default false check (not retrieval_authorized),
  synthetic_only boolean not null default true check (synthetic_only),
  finalized_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (package_id),
  unique (case_id),
  unique (id, case_id),
  foreign key (package_id, case_id)
    references public.claimant_release_packages(id, case_id) on delete restrict,
  foreign key (release_authorization_id, case_id)
    references public.claimant_release_authorizations(id, case_id) on delete restrict,
  foreign key (signing_key_id, signing_authority_id)
    references public.claimant_release_signing_keys(id, authority_id) on delete restrict,
  check (expires_at > finalized_at)
);

create table public.claimant_release_signed_manifests (
  id uuid primary key,
  finalization_id uuid not null,
  package_id uuid not null,
  case_id uuid not null,
  ordinal integer not null check (ordinal between 1 and 10),
  grant_id uuid not null references public.claimant_recipient_grants(id) on delete restrict,
  signing_key_id uuid not null references public.claimant_release_signing_keys(id) on delete restrict,
  protocol text not null default 'sanduqkin:claim:release-package:v1'
    check (protocol = 'sanduqkin:claim:release-package:v1'),
  signature_algorithm text not null default 'ed25519' check (signature_algorithm = 'ed25519'),
  canonical_manifest text not null check (length(canonical_manifest) between 256 and 65536),
  manifest_digest text not null check (manifest_digest ~ '^[0-9a-f]{64}$'),
  detached_signature text not null check (
    length(detached_signature) = 86 and detached_signature ~ '^[A-Za-z0-9_-]+$'
  ),
  signature_verified_at timestamptz not null,
  synthetic_only boolean not null default true check (synthetic_only),
  unique (finalization_id, ordinal),
  unique (package_id, grant_id),
  unique (package_id, manifest_digest),
  foreign key (finalization_id, case_id)
    references public.claimant_release_package_finalizations(id, case_id) on delete restrict,
  foreign key (package_id, case_id)
    references public.claimant_release_packages(id, case_id) on delete restrict
);

create table public.claimant_release_package_finalization_events (
  id uuid primary key default gen_random_uuid(),
  finalization_id uuid not null,
  case_id uuid not null,
  event_type text not null check (event_type = 'release_package_finalized'),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and metadata = '{}'::jsonb),
  unique (case_id, idempotency_key, event_type),
  foreign key (finalization_id, case_id)
    references public.claimant_release_package_finalizations(id, case_id) on delete restrict
);

create table public.claimant_release_package_finalization_idempotency (
  operation text not null check (operation = 'finalize_signed_release_package'),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  signing_authority_id uuid not null
    references public.claimant_release_signing_authorities(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (operation, case_id, signing_authority_id, idempotency_key)
);

create index claimant_release_signing_keys_authority_idx
on public.claimant_release_signing_keys (authority_id);
create index claimant_release_package_finalizations_authorization_case_idx
on public.claimant_release_package_finalizations (release_authorization_id, case_id);
create index claimant_release_package_finalizations_authority_idx
on public.claimant_release_package_finalizations (signing_authority_id);
create index claimant_release_package_finalizations_key_idx
on public.claimant_release_package_finalizations (signing_key_id);
create index claimant_release_signed_manifests_finalization_case_idx
on public.claimant_release_signed_manifests (finalization_id, case_id);
create index claimant_release_signed_manifests_grant_idx
on public.claimant_release_signed_manifests (grant_id);
create index claimant_release_signed_manifests_key_idx
on public.claimant_release_signed_manifests (signing_key_id);
create index claimant_release_package_finalization_events_actor_idx
on public.claimant_release_package_finalization_events (actor_user_id);
create index claimant_release_package_finalization_idempotency_authority_idx
on public.claimant_release_package_finalization_idempotency (signing_authority_id);

revoke all on table public.claimant_release_signing_authorities from public;
revoke all on table public.claimant_release_signing_authorities from anon;
revoke all on table public.claimant_release_signing_authorities from authenticated;
revoke all on table public.claimant_release_signing_keys from public;
revoke all on table public.claimant_release_signing_keys from anon;
revoke all on table public.claimant_release_signing_keys from authenticated;
revoke all on table public.claimant_release_package_finalizations from public;
revoke all on table public.claimant_release_package_finalizations from anon;
revoke all on table public.claimant_release_package_finalizations from authenticated;
revoke all on table public.claimant_release_signed_manifests from public;
revoke all on table public.claimant_release_signed_manifests from anon;
revoke all on table public.claimant_release_signed_manifests from authenticated;
revoke all on table public.claimant_release_package_finalization_events from public;
revoke all on table public.claimant_release_package_finalization_events from anon;
revoke all on table public.claimant_release_package_finalization_events from authenticated;
revoke all on table public.claimant_release_package_finalization_idempotency from public;
revoke all on table public.claimant_release_package_finalization_idempotency from anon;
revoke all on table public.claimant_release_package_finalization_idempotency from authenticated;
grant select, insert, update on table public.claimant_release_signing_authorities to service_role;
grant select, insert, update on table public.claimant_release_signing_keys to service_role;
grant select, insert on table public.claimant_release_package_finalizations to service_role;
grant select, insert on table public.claimant_release_signed_manifests to service_role;
grant select, insert on table public.claimant_release_package_finalization_events to service_role;
grant select, insert on table public.claimant_release_package_finalization_idempotency to service_role;
grant update on table public.claimant_cases to service_role;

alter table public.claimant_release_signing_authorities enable row level security;
alter table public.claimant_release_signing_authorities force row level security;
alter table public.claimant_release_signing_keys enable row level security;
alter table public.claimant_release_signing_keys force row level security;
alter table public.claimant_release_package_finalizations enable row level security;
alter table public.claimant_release_package_finalizations force row level security;
alter table public.claimant_release_signed_manifests enable row level security;
alter table public.claimant_release_signed_manifests force row level security;
alter table public.claimant_release_package_finalization_events enable row level security;
alter table public.claimant_release_package_finalization_events force row level security;
alter table public.claimant_release_package_finalization_idempotency enable row level security;
alter table public.claimant_release_package_finalization_idempotency force row level security;
create policy "Claimant release signing authorities are server-only."
on public.claimant_release_signing_authorities for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release signing keys are server-only."
on public.claimant_release_signing_keys for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release package finalizations are server-only."
on public.claimant_release_package_finalizations for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release signed manifests are server-only."
on public.claimant_release_signed_manifests for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release finalization events are server-only."
on public.claimant_release_package_finalization_events for all to anon, authenticated
using (false) with check (false);
create policy "Claimant release finalization idempotency is server-only."
on public.claimant_release_package_finalization_idempotency for all to anon, authenticated
using (false) with check (false);

create function public.claimant_finalize_signed_release_package(
  p_case_id uuid, p_package_id uuid, p_release_authorization_id uuid,
  p_signing_authority_id uuid, p_signing_key_id uuid,
  p_expected_signing_key_version integer, p_verified_public_key_digest text,
  p_expected_case_version integer,
  p_finalization_id uuid, p_manifests jsonb, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_package public.claimant_release_packages%rowtype;
  v_authorization public.claimant_release_authorizations%rowtype;
  v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_round public.claimant_review_rounds%rowtype;
  v_release_authority public.claimant_release_authority_identities%rowtype;
  v_signing_authority public.claimant_release_signing_authorities%rowtype;
  v_signing_key public.claimant_release_signing_keys%rowtype;
  v_existing public.claimant_release_package_finalization_idempotency%rowtype;
  v_grant record; v_entry record; v_manifest jsonb; v_release_material jsonb;
  v_request_digest text; v_manifest_digest text; v_manifest_set text := '';
  v_manifest_set_digest text; v_expected_asset_digests jsonb; v_expected_grant_digest text;
  v_manifest_count integer; v_finalized_at timestamptz := now(); v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:signed-release-package:' || p_case_id::text, 0));
  if p_expected_case_version < 3 or p_expected_signing_key_version < 1
    or p_verified_public_key_digest !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_manifests) <> 'array' then
    raise exception 'Signed package input is invalid.' using errcode = '22023';
  end if;
  v_manifest_count := jsonb_array_length(p_manifests);
  if v_manifest_count not between 2 and 10 then
    raise exception 'Signed manifest bounds are invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_package_id::text, p_release_authorization_id::text, p_signing_authority_id::text,
    p_signing_key_id::text, p_expected_signing_key_version::text,
    p_verified_public_key_digest, p_expected_case_version::text,
    p_finalization_id::text, p_manifests::text),
    'sha256'), 'hex');
  select * into v_existing from public.claimant_release_package_finalization_idempotency
  where operation = 'finalize_signed_release_package' and case_id = p_case_id
    and signing_authority_id = p_signing_authority_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was used with different finalization input.'
        using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_package from public.claimant_release_packages
  where id = p_package_id and case_id = p_case_id;
  select * into v_authorization from public.claimant_release_authorizations
  -- Append-only record; mutable case, review, and authorities are locked separately.
  where id = p_release_authorization_id and case_id = p_case_id;
  select * into v_cycle from public.claimant_owner_protection_cycles
  where id = v_package.cycle_id and case_id = p_case_id for update;
  select * into v_round from public.claimant_review_rounds
  where id = v_package.review_round_id and case_id = p_case_id for update;
  select * into v_release_authority from public.claimant_release_authority_identities
  where id = v_authorization.authority_identity_id for update;
  select * into v_signing_authority from public.claimant_release_signing_authorities
  where id = p_signing_authority_id for update;
  select * into v_signing_key from public.claimant_release_signing_keys
  where id = p_signing_key_id and authority_id = p_signing_authority_id for update;
  if v_case.id is null or v_case.state <> 'approved'
    or v_case.version <> p_expected_case_version
    or v_package.id is null or v_package.case_version <> p_expected_case_version
    or v_package.release_authorization_id <> p_release_authorization_id
    or v_package.status <> 'prepared_unsigned' or v_package.manifest_signed
    or v_package.retrieval_authorized or v_package.expires_at <= v_finalized_at
    or v_authorization.id is null
    or v_authorization.authorized_case_version <> p_expected_case_version
    or v_authorization.status <> 'authorized' or not v_authorization.release_authorized
    or v_authorization.package_creation_authorized or v_authorization.retrieval_authorized
    or v_authorization.policy_pack_id <> v_case.policy_pack_id
    or v_authorization.policy_pack_version <> v_case.policy_pack_version
    or v_cycle.id is null or v_cycle.status <> 'delivery_verified'
    or v_cycle.cooldown_expires_at is null or v_cycle.cooldown_expires_at > v_finalized_at
    or v_round.id is null or v_round.status <> 'two_person_approved'
    or not v_round.two_person_approval_satisfied or v_round.release_authorized
    or v_round.round_version <> v_authorization.review_round_version
    or v_release_authority.id is null or v_release_authority.status <> 'active'
    or not v_release_authority.synthetic_only or v_release_authority.live_release_authority
    or v_signing_authority.id is null or v_signing_authority.status <> 'active'
    or not v_signing_authority.synthetic_only or v_signing_authority.live_signing_authority
    or v_signing_authority.user_id in (v_case.owner_user_id, v_case.claimant_user_id,
      v_release_authority.user_id)
    or v_signing_key.id is null or v_signing_key.status <> 'active'
    or v_signing_key.key_version <> p_expected_signing_key_version
    or v_signing_key.signature_algorithm <> 'ed25519'
    or not v_signing_key.synthetic_only
    or v_finalized_at < v_signing_key.valid_from or v_finalized_at >= v_signing_key.valid_until
    or v_signing_key.public_key_digest <> p_verified_public_key_digest
    or v_signing_key.public_key_digest <> encode(extensions.digest(
      decode(translate(v_signing_key.public_key, '-_', '+/') ||
        repeat('=', (4 - length(v_signing_key.public_key) % 4) % 4), 'base64'),
      'sha256'), 'hex')
    or exists (select 1 from public.claimant_review_interventions intervention
      where intervention.case_id = p_case_id)
    or exists (select 1 from public.claimant_reviewer_identities reviewer
      where reviewer.user_id = v_signing_authority.user_id)
    or exists (select 1 from public.claimant_review_resolution_authorities resolution
      where resolution.user_id = v_signing_authority.user_id) then
    raise exception 'Signed package authority changed.' using errcode = '42501';
  end if;
  if v_manifest_count <> v_package.grant_count
    or (select count(*) from public.claimant_release_package_grants
      where package_id = p_package_id) <> v_package.grant_count
    or (select count(*) from public.claimant_release_package_assets
      where package_id = p_package_id) <> v_package.asset_count then
    raise exception 'Signed package membership changed.' using errcode = '40001';
  end if;
  if exists (select 1 from public.claimant_release_package_assets package_asset
    left join public.vault_assets asset on asset.id = package_asset.source_asset_id
      and asset.user_id = v_package.owner_user_id and asset.deleted_at is null
    where package_asset.package_id = p_package_id and (asset.id is null
      or asset.asset_type <> package_asset.asset_type
      or asset.updated_at <> package_asset.source_updated_at
      or asset.ciphertext <> package_asset.ciphertext or asset.nonce <> package_asset.nonce)) then
    raise exception 'Signed package asset authority changed.' using errcode = '40001';
  end if;
  select jsonb_agg(to_jsonb(rtrim(translate(encode(extensions.digest(
    decode(translate(package_asset.ciphertext, '-_', '+/') ||
      repeat('=', (4 - length(package_asset.ciphertext) % 4) % 4), 'base64'),
    'sha256'), 'base64'), '+/', '-_'), '=')) order by package_asset.ordinal)
  into v_expected_asset_digests from public.claimant_release_package_assets package_asset
  where package_asset.package_id = p_package_id;
  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_manifests) with ordinality loop
    if jsonb_typeof(v_entry.value) <> 'object'
      or (select count(*) from jsonb_object_keys(v_entry.value)) <> 6
      or not (v_entry.value ?& array['manifest_id', 'grant_id', 'canonical_manifest',
        'manifest_digest', 'detached_signature', 'signature_verified_at']) then
      raise exception 'Signed manifest input is invalid.' using errcode = '22023';
    end if;
    select package_grant.*, source_grant.protocol as source_protocol,
      source_grant.profile as source_profile, source_grant.key_agreement,
      source_grant.kdf, source_grant.aead, source_grant.owner_ephemeral_public_key,
      source_grant.nonce as source_nonce, source_grant.ciphertext as source_ciphertext,
      source_grant.status as source_status, device_key.status as key_status,
      device_key.key_version as current_key_version, case_key.status as case_key_status
    into v_grant from public.claimant_release_package_grants package_grant
    join public.claimant_recipient_grants source_grant on source_grant.id = package_grant.grant_id
    join public.claimant_case_device_keys case_key on case_key.case_id = source_grant.case_id
      and case_key.key_id = source_grant.recipient_key_id
      and case_key.claimant_user_id = source_grant.claimant_user_id
    join public.claimant_device_keys device_key on device_key.id = case_key.key_id
      and device_key.claimant_user_id = case_key.claimant_user_id
    where package_grant.package_id = p_package_id and package_grant.ordinal = v_entry.ordinal
      for update of source_grant;
    if v_grant.grant_id is null
      or v_grant.grant_id <> (v_entry.value ->> 'grant_id')::uuid
      or v_grant.source_status <> 'active' or v_grant.key_status <> 'active'
      or v_grant.case_key_status <> 'active'
      or v_grant.current_key_version <> v_grant.recipient_key_version
      or v_grant.sealed_grant_digest <> encode(extensions.digest(concat_ws('|',
        v_grant.grant_id::text, v_grant.grant_version::text,
        v_grant.recipient_key_id::text, v_grant.recipient_key_version::text,
        v_grant.source_protocol, v_grant.source_profile, v_grant.key_agreement,
        v_grant.kdf, v_grant.aead, v_grant.owner_ephemeral_public_key,
        v_grant.source_nonce, v_grant.source_ciphertext), 'sha256'), 'hex') then
      raise exception 'Signed package grant authority changed.' using errcode = '40001';
    end if;
    begin v_manifest := (v_entry.value ->> 'canonical_manifest')::jsonb;
    exception when others then
      raise exception 'Signed manifest JSON is invalid.' using errcode = '22023';
    end;
    v_manifest_digest := encode(extensions.digest(
      v_entry.value ->> 'canonical_manifest', 'sha256'), 'hex');
    v_release_material := v_manifest -> 'release_material';
    v_expected_grant_digest := rtrim(translate(encode(extensions.digest(
      decode(translate(v_grant.source_ciphertext, '-_', '+/') ||
        repeat('=', (4 - length(v_grant.source_ciphertext) % 4) % 4), 'base64'),
      'sha256'), 'base64'), '+/', '-_'), '=');
    if v_manifest_digest <> v_entry.value ->> 'manifest_digest'
      or (v_entry.value ->> 'signature_verified_at')::timestamptz > v_finalized_at
      or (v_entry.value ->> 'signature_verified_at')::timestamptz <
        v_finalized_at - interval '5 minutes'
      or (select count(*) from jsonb_object_keys(v_manifest)) <> 14
      or v_manifest ->> 'protocol' <> 'sanduqkin:claim:release-package:v1'
      or (v_manifest ->> 'claim_id')::uuid <> p_case_id
      or (v_manifest ->> 'release_package_id')::uuid <> p_package_id
      or (v_manifest ->> 'owner_id')::uuid <> v_package.owner_user_id
      or (v_manifest ->> 'claimant_id')::uuid <> v_package.claimant_user_id
      or (v_manifest ->> 'claim_version')::integer <> p_expected_case_version
      or (v_manifest ->> 'cancellation_version')::integer <> v_cycle.cycle_number
      or (v_manifest ->> 'created_at')::timestamptz <> v_package.prepared_at
      or (v_manifest ->> 'expires_at')::timestamptz <> v_package.expires_at
      or (v_manifest ->> 'asset_snapshot_boundary')::timestamptz <>
        v_package.asset_snapshot_boundary
      or v_manifest -> 'asset_ciphertext_digests' <> v_expected_asset_digests
      or (v_manifest ->> 'policy_decision_version')::integer <>
        v_authorization.policy_pack_version
      or v_manifest ->> 'signing_key_id' <> v_signing_key.signing_key_id
      or (select count(*) from jsonb_object_keys(v_release_material)) <> 7
      or v_release_material ->> 'profile' <> 'registered_recipient_v1'
      or (v_release_material ->> 'grant_id')::uuid <> v_grant.grant_id
      or (v_release_material ->> 'grant_version')::integer <> v_grant.grant_version
      or (v_release_material ->> 'recipient_id')::uuid <> v_package.claimant_user_id
      or (v_release_material ->> 'recipient_key_id')::uuid <> v_grant.recipient_key_id
      or (v_release_material ->> 'recipient_key_version')::integer <>
        v_grant.recipient_key_version
      or v_release_material ->> 'sealed_grant_digest' <> v_expected_grant_digest then
      raise exception 'Signed manifest binding changed.' using errcode = '40001';
    end if;
    v_manifest_set := v_manifest_set || concat_ws(':', v_entry.ordinal::text,
      v_grant.grant_id::text, v_manifest_digest) || '|';
  end loop;
  v_manifest_set_digest := encode(extensions.digest(concat_ws('|',
    'sanduqkin:claim:signed-manifest-set:v1', v_package.preparation_manifest_digest,
    v_manifest_set), 'sha256'), 'hex');
  insert into public.claimant_release_package_finalizations (id, package_id, case_id,
    release_authorization_id, signing_authority_id, signing_key_id, source_case_version,
    finalized_case_version, preparation_manifest_digest, signed_manifest_set_digest,
    manifest_count, finalized_at, expires_at)
  values (p_finalization_id, p_package_id, p_case_id, p_release_authorization_id,
    p_signing_authority_id, p_signing_key_id, p_expected_case_version,
    p_expected_case_version + 1, v_package.preparation_manifest_digest,
    v_manifest_set_digest, v_manifest_count, v_finalized_at, v_package.expires_at);
  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_manifests) with ordinality loop
    insert into public.claimant_release_signed_manifests (id, finalization_id,
      package_id, case_id, ordinal, grant_id, signing_key_id, canonical_manifest,
      manifest_digest, detached_signature, signature_verified_at)
    values ((v_entry.value ->> 'manifest_id')::uuid, p_finalization_id,
      p_package_id, p_case_id, v_entry.ordinal, (v_entry.value ->> 'grant_id')::uuid,
      p_signing_key_id, v_entry.value ->> 'canonical_manifest',
      v_entry.value ->> 'manifest_digest', v_entry.value ->> 'detached_signature',
      (v_entry.value ->> 'signature_verified_at')::timestamptz);
  end loop;
  update public.claimant_cases set state = 'release_ready',
    version = version + 1, updated_at = v_finalized_at
  where id = p_case_id and state = 'approved' and version = p_expected_case_version;
  if not found then
    raise exception 'Signed package case changed.' using errcode = '40001';
  end if;
  insert into public.claimant_release_package_finalization_events (finalization_id,
    case_id, event_type, actor_user_id, idempotency_key)
  values (p_finalization_id, p_case_id, 'release_package_finalized',
    v_signing_authority.user_id, p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id,
    'case_version', p_expected_case_version + 1, 'case_state', 'release_ready',
    'release_package_id', p_package_id, 'finalization_id', p_finalization_id,
    'finalization_status', 'finalized_release_ready',
    'manifest_count', v_manifest_count, 'manifest_signed', true,
    'retrieval_authorized', false, 'replayed', false);
  insert into public.claimant_release_package_finalization_idempotency (operation,
    case_id, signing_authority_id, idempotency_key, request_digest, result)
  values ('finalize_signed_release_package', p_case_id, p_signing_authority_id,
    p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Signed package conflicts with existing finalization.'
    using errcode = '40001';
end $function$;

revoke all on function public.claimant_finalize_signed_release_package(
  uuid, uuid, uuid, uuid, uuid, integer, text, integer, uuid, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_finalize_signed_release_package(
  uuid, uuid, uuid, uuid, uuid, integer, text, integer, uuid, jsonb, uuid
) to service_role;
