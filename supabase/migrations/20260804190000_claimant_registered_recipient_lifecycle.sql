alter table public.claimant_idempotency_records
drop constraint claimant_idempotency_records_operation_check;
alter table public.claimant_idempotency_records
add constraint claimant_idempotency_records_operation_check check (operation in (
  'issue_registered_invitation', 'accept_registered_invitation',
  'activate_claimant_session', 'revoke_claimant_session',
  'revoke_registered_invitation', 'lifecycle_enroll', 'lifecycle_replace',
  'lifecycle_revoke', 'lifecycle_finalize'
));

alter table public.claimant_audit_events
drop constraint claimant_audit_events_event_type_check;
alter table public.claimant_audit_events
add constraint claimant_audit_events_event_type_check check (event_type in (
  'registered_invitation_issued', 'registered_invitation_accepted',
  'registered_invitation_revoked', 'claimant_key_enrolled', 'claimant_key_replaced',
  'claimant_key_revoked', 'claim_draft_created', 'registered_recipient_finalized'
));

alter table public.claimant_outbox drop constraint claimant_outbox_topic_check;
alter table public.claimant_outbox add constraint claimant_outbox_topic_check check (topic in (
  'registered_invitation_issued', 'registered_invitation_revoked',
  'registered_recipient_case_created', 'registered_recipient_binding_invalidated',
  'registered_recipient_finalized'
));

alter table public.claimant_cases
add column binding_version integer not null default 1 check (binding_version > 0),
add column finalization_version integer not null default 0 check (finalization_version >= 0),
add column owner_finalized_at timestamptz null;

create table public.claimant_case_device_keys (
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  key_id uuid not null,
  claimant_user_id uuid not null references public.claimant_identities(user_id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'revoked')),
  added_at timestamptz not null default now(),
  revoked_at timestamptz null,
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null)),
  primary key (case_id, key_id),
  unique (key_id),
  foreign key (key_id, claimant_user_id)
    references public.claimant_device_keys(id, claimant_user_id) on delete restrict
);

insert into public.claimant_case_device_keys(case_id, key_id, claimant_user_id)
select id, current_key_id, claimant_user_id from public.claimant_cases;

create function public.bind_claimant_case_initial_key()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  insert into public.claimant_case_device_keys(case_id, key_id, claimant_user_id)
  values (new.id, new.current_key_id, new.claimant_user_id);
  return new;
end $function$;

create trigger bind_claimant_case_initial_key_after_insert
after insert on public.claimant_cases for each row
execute function public.bind_claimant_case_initial_key();

revoke all on function public.bind_claimant_case_initial_key()
from public, anon, authenticated;

revoke all on table public.claimant_case_device_keys from public;
revoke all on table public.claimant_case_device_keys from anon;
revoke all on table public.claimant_case_device_keys from authenticated;
grant select, insert, update on table public.claimant_case_device_keys to service_role;
alter table public.claimant_case_device_keys enable row level security;
alter table public.claimant_case_device_keys force row level security;
create policy "Claimant case device keys are server-only."
on public.claimant_case_device_keys for all to anon, authenticated
using (false) with check (false);

create table public.claimant_recipient_grants (
  id uuid primary key,
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  claimant_user_id uuid not null references public.claimant_identities(user_id) on delete restrict,
  recipient_key_id uuid not null,
  recipient_key_version integer not null check (recipient_key_version > 0),
  protocol text not null check (protocol = 'sanduqkin:claim:recipient-grant:v2'),
  profile text not null check (profile = 'registered_recipient_v2'),
  key_agreement text not null check (key_agreement = 'p256_ecdh'),
  kdf text not null check (kdf = 'hkdf_sha256'),
  aead text not null check (aead = 'xchacha20poly1305_ietf'),
  owner_ephemeral_public_key text not null check (
    owner_ephemeral_public_key ~ '^[A-Za-z0-9_-]{87}$'
  ),
  nonce text not null check (nonce ~ '^[A-Za-z0-9_-]{32}$'),
  ciphertext text not null check (
    length(ciphertext) >= 64 and ciphertext ~ '^[A-Za-z0-9_-]+$'
  ),
  grant_version integer not null check (grant_version > 0),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null,
  revoked_at timestamptz null,
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null)),
  foreign key (recipient_key_id, claimant_user_id)
    references public.claimant_device_keys(id, claimant_user_id) on delete restrict,
  unique (case_id, recipient_key_id, grant_version)
);

create unique index claimant_recipient_grants_active_key_idx
on public.claimant_recipient_grants (case_id, recipient_key_id) where status = 'active';

revoke all on table public.claimant_recipient_grants from public;
revoke all on table public.claimant_recipient_grants from anon;
revoke all on table public.claimant_recipient_grants from authenticated;
grant select, insert, update on table public.claimant_recipient_grants to service_role;
alter table public.claimant_recipient_grants enable row level security;
alter table public.claimant_recipient_grants force row level security;
create policy "Claimant recipient grants are server-only."
on public.claimant_recipient_grants for all to anon, authenticated
using (false) with check (false);

create function public.claimant_revoke_registered_invitation(
  p_owner_user_id uuid, p_invitation_id uuid, p_expected_version integer,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_existing public.claimant_idempotency_records%rowtype;
  v_invitation public.claimant_invitations%rowtype;
  v_digest text;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:invitation:' || p_invitation_id::text, 0));
  v_digest := encode(extensions.digest(concat_ws('|', p_owner_user_id, p_invitation_id, p_expected_version), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records where
    operation = 'revoke_registered_invitation' and actor_user_id = p_owner_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then raise exception 'Idempotency input changed.' using errcode = '22023'; end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;

  update public.claimant_invitations set status = 'revoked', revoked_at = now(),
    version = version + 1, updated_at = now()
  where id = p_invitation_id and owner_user_id = p_owner_user_id
    and status = 'pending' and version = p_expected_version
  returning * into v_invitation;
  if not found then raise exception 'Invitation is unavailable.' using errcode = 'P0002'; end if;

  insert into public.claimant_audit_events(event_type, actor_user_id, invitation_id, idempotency_key)
  values ('registered_invitation_revoked', p_owner_user_id, p_invitation_id, p_idempotency_key);
  insert into public.claimant_outbox(topic, aggregate_type, aggregate_id, dedupe_key, payload)
  values ('registered_invitation_revoked', 'invitation', p_invitation_id,
    'registered_invitation_revoked:' || p_idempotency_key, jsonb_build_object('event', 'registered_invitation_revoked'));
  v_result := jsonb_build_object('invitation_id', p_invitation_id,
    'invitation_version', v_invitation.version, 'revoked', true, 'replayed', false);
  insert into public.claimant_idempotency_records(operation, actor_user_id, idempotency_key, request_digest, result)
  values ('revoke_registered_invitation', p_owner_user_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end $function$;

create function public.claimant_manage_registered_recipient(
  p_action text, p_actor_user_id uuid, p_case_id uuid, p_expected_case_version integer,
  p_target_key_id uuid, p_device_binding_digest text, p_public_key_jwk jsonb,
  p_grants jsonb, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_existing public.claimant_idempotency_records%rowtype;
  v_key public.claimant_device_keys%rowtype;
  v_new_key public.claimant_device_keys%rowtype;
  v_grant jsonb;
  v_digest text;
  v_operation text;
  v_result jsonb;
  v_active_keys integer;
  v_was_finalized boolean;
begin
  if p_action not in ('enroll', 'replace', 'revoke', 'finalize') then
    raise exception 'Lifecycle action is invalid.' using errcode = '22023';
  end if;
  v_operation := 'lifecycle_' || p_action;
  perform pg_advisory_xact_lock(hashtextextended('claimant:case:' || p_case_id::text, 0));
  v_digest := encode(extensions.digest(concat_ws('|', p_action, p_actor_user_id, p_case_id,
    p_expected_case_version, p_target_key_id, p_device_binding_digest, p_public_key_jwk::text,
    p_grants::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records where
    operation = v_operation and actor_user_id = p_actor_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then raise exception 'Idempotency input changed.' using errcode = '22023'; end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;

  select * into v_case from public.claimant_cases where id = p_case_id for update;
  if not found or v_case.version <> p_expected_case_version then
    raise exception 'Case is unavailable or stale.' using errcode = '40001';
  end if;
  if (p_action = 'finalize' and v_case.owner_user_id <> p_actor_user_id)
    or (p_action <> 'finalize' and v_case.claimant_user_id <> p_actor_user_id) then
    raise exception 'Case is unavailable.' using errcode = '42501';
  end if;

  if p_action in ('enroll', 'replace') then
    if p_device_binding_digest is null or p_public_key_jwk is null then
      raise exception 'Public device key input is required.' using errcode = '22023';
    end if;
    insert into public.claimant_device_keys(claimant_user_id, device_binding_digest, public_key_jwk)
    values (v_case.claimant_user_id, p_device_binding_digest, p_public_key_jwk)
    returning * into v_new_key;
    insert into public.claimant_case_device_keys(case_id, key_id, claimant_user_id)
    values (p_case_id, v_new_key.id, v_case.claimant_user_id);
  end if;

  if p_action in ('replace', 'revoke') then
    select k.* into v_key from public.claimant_device_keys k
    join public.claimant_case_device_keys ck on ck.key_id = k.id
    where ck.case_id = p_case_id and ck.status = 'active' and k.id = p_target_key_id
      and k.claimant_user_id = v_case.claimant_user_id and k.status = 'active' for update of k;
    if not found then raise exception 'Device key is unavailable.' using errcode = 'P0002'; end if;
    if p_action = 'revoke' then
      select count(*) into v_active_keys from public.claimant_case_device_keys
      where case_id = p_case_id and status = 'active';
      if v_active_keys <= 1 then raise exception 'The last active device key cannot be revoked.' using errcode = '23514'; end if;
    end if;
    update public.claimant_device_keys set status = 'revoked', revoked_at = now(), updated_at = now()
    where id = v_key.id;
    update public.claimant_case_device_keys set status = 'revoked', revoked_at = now()
    where case_id = p_case_id and key_id = v_key.id;
    update public.claimant_recipient_grants set status = 'revoked', revoked_at = now()
    where case_id = p_case_id and status = 'active';
    update public.claimant_cases set
      current_key_id = case when current_key_id = v_key.id and p_action = 'replace'
        then v_new_key.id when current_key_id = v_key.id then (
          select key_id from public.claimant_case_device_keys where case_id = p_case_id
            and status = 'active' and key_id <> v_key.id order by added_at limit 1
        ) else current_key_id end,
      owner_finalized_at = null, binding_version = binding_version + 1,
      version = version + 1, updated_at = now()
    where id = p_case_id returning * into v_case;
    insert into public.claimant_outbox(topic, aggregate_type, aggregate_id, dedupe_key, payload)
    values ('registered_recipient_binding_invalidated', 'case', p_case_id,
      'registered_recipient_binding_invalidated:' || p_idempotency_key,
      jsonb_build_object('event', 'registered_recipient_binding_invalidated'));
  elsif p_action = 'enroll' then
    v_was_finalized := v_case.owner_finalized_at is not null;
    update public.claimant_recipient_grants set status = 'revoked', revoked_at = now()
    where case_id = p_case_id and status = 'active';
    update public.claimant_cases set owner_finalized_at = null, binding_version = binding_version + 1,
      version = version + 1, updated_at = now() where id = p_case_id returning * into v_case;
    if v_was_finalized then
      insert into public.claimant_outbox(topic, aggregate_type, aggregate_id, dedupe_key, payload)
      values ('registered_recipient_binding_invalidated', 'case', p_case_id,
        'registered_recipient_binding_invalidated:' || p_idempotency_key,
        jsonb_build_object('event', 'registered_recipient_binding_invalidated'));
    end if;
  else
    select count(*) into v_active_keys from public.claimant_case_device_keys
    where case_id = p_case_id and status = 'active';
    if v_active_keys < 2 or jsonb_typeof(p_grants) <> 'array'
      or jsonb_array_length(p_grants) <> v_active_keys then
      raise exception 'A grant is required for every active device key.' using errcode = '23514';
    end if;
    if (select count(distinct value ->> 'recipient_key_id') from jsonb_array_elements(p_grants)) <> v_active_keys then
      raise exception 'Grant device keys must be unique.' using errcode = '23514';
    end if;
    update public.claimant_recipient_grants set status = 'revoked', revoked_at = now()
    where case_id = p_case_id and status = 'active';
    for v_grant in select value from jsonb_array_elements(p_grants) loop
      select k.* into v_key from public.claimant_device_keys k
      join public.claimant_case_device_keys ck on ck.key_id = k.id
      where ck.case_id = p_case_id and ck.status = 'active'
        and k.id = (v_grant ->> 'recipient_key_id')::uuid
        and k.claimant_user_id = v_case.claimant_user_id and k.status = 'active'
        and k.key_version = (v_grant ->> 'recipient_key_version')::integer;
      if not found or v_grant ->> 'recipient_id' <> v_case.claimant_user_id::text
        or v_grant ->> 'protocol' <> 'sanduqkin:claim:recipient-grant:v2'
        or v_grant ->> 'profile' <> 'registered_recipient_v2'
        or v_grant ->> 'key_agreement' <> 'p256_ecdh' or v_grant ->> 'kdf' <> 'hkdf_sha256'
        or v_grant ->> 'aead' <> 'xchacha20poly1305_ietf'
        or v_grant -> 'revoked_at' is distinct from 'null'::jsonb then
        raise exception 'Recipient grant binding is invalid.' using errcode = '23514';
      end if;
      insert into public.claimant_recipient_grants(id, case_id, owner_user_id, claimant_user_id,
        recipient_key_id, recipient_key_version, protocol, profile, key_agreement, kdf, aead,
        owner_ephemeral_public_key, nonce, ciphertext, grant_version, created_at)
      values ((v_grant ->> 'grant_id')::uuid, p_case_id, v_case.owner_user_id, v_case.claimant_user_id,
        v_key.id, v_key.key_version, v_grant ->> 'protocol', v_grant ->> 'profile',
        v_grant ->> 'key_agreement', v_grant ->> 'kdf', v_grant ->> 'aead',
        v_grant ->> 'owner_ephemeral_public_key', v_grant ->> 'nonce', v_grant ->> 'ciphertext',
        (v_grant ->> 'grant_version')::integer, (v_grant ->> 'created_at')::timestamptz);
    end loop;
    update public.claimant_cases set owner_finalized_at = now(),
      finalization_version = finalization_version + 1, version = version + 1, updated_at = now()
    where id = p_case_id returning * into v_case;
    insert into public.claimant_outbox(topic, aggregate_type, aggregate_id, dedupe_key, payload)
    values ('registered_recipient_finalized', 'case', p_case_id,
      'registered_recipient_finalized:' || p_idempotency_key,
      jsonb_build_object('event', 'registered_recipient_finalized'));
  end if;

  insert into public.claimant_audit_events(event_type, actor_user_id, invitation_id, case_id, idempotency_key, metadata)
  values (case p_action when 'enroll' then 'claimant_key_enrolled' when 'replace' then 'claimant_key_replaced'
    when 'revoke' then 'claimant_key_revoked' else 'registered_recipient_finalized' end,
    p_actor_user_id, v_case.invitation_id, p_case_id, p_idempotency_key,
    jsonb_build_object('case_version', v_case.version, 'binding_version', v_case.binding_version));
  v_result := jsonb_build_object('action', p_action, 'case_id', p_case_id,
    'case_version', v_case.version, 'binding_version', v_case.binding_version,
    'finalization_version', v_case.finalization_version, 'replayed', false)
    || case when p_action in ('enroll', 'replace') then jsonb_build_object('claimant_key_id', v_new_key.id)
      else '{}'::jsonb end;
  insert into public.claimant_idempotency_records(operation, actor_user_id, idempotency_key, request_digest, result)
  values (v_operation, p_actor_user_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end $function$;

revoke all on function public.claimant_revoke_registered_invitation(uuid, uuid, integer, uuid)
from public, anon, authenticated;
revoke all on function public.claimant_manage_registered_recipient(text, uuid, uuid, integer, uuid, text, jsonb, jsonb, uuid)
from public, anon, authenticated;
grant execute on function public.claimant_revoke_registered_invitation(uuid, uuid, integer, uuid) to service_role;
grant execute on function public.claimant_manage_registered_recipient(text, uuid, uuid, integer, uuid, text, jsonb, jsonb, uuid) to service_role;
