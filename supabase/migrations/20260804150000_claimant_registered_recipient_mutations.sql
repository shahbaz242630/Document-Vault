create table public.claimant_idempotency_records (
  operation text not null check (
    operation in ('issue_registered_invitation', 'accept_registered_invitation')
  ),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (expires_at > created_at),
  primary key (operation, actor_user_id, idempotency_key)
);

create index claimant_idempotency_expiry_idx
on public.claimant_idempotency_records (expires_at);

create table public.claimant_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in (
      'registered_invitation_issued',
      'registered_invitation_accepted',
      'claimant_key_enrolled',
      'claim_draft_created'
    )
  ),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  invitation_id uuid null references public.claimant_invitations(id) on delete restrict,
  case_id uuid null references public.claimant_cases(id) on delete restrict,
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  check (invitation_id is not null or case_id is not null),
  unique (actor_user_id, idempotency_key, event_type)
);

create index claimant_audit_case_time_idx
on public.claimant_audit_events (case_id, occurred_at desc)
where case_id is not null;

create index claimant_audit_invitation_time_idx
on public.claimant_audit_events (invitation_id, occurred_at desc)
where invitation_id is not null;

create table public.claimant_outbox (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (
    topic in ('registered_invitation_issued', 'registered_recipient_case_created')
  ),
  aggregate_type text not null check (aggregate_type in ('invitation', 'case')),
  aggregate_id uuid not null,
  dedupe_key text not null unique check (length(dedupe_key) between 1 and 200),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'delivered', 'failed', 'cancelled')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz null,
  check (updated_at >= created_at),
  check (processed_at is null or processed_at >= created_at)
);

create index claimant_outbox_delivery_idx
on public.claimant_outbox (status, available_at, created_at)
where status in ('pending', 'failed');

revoke all on table public.claimant_idempotency_records from public;
revoke all on table public.claimant_idempotency_records from anon;
revoke all on table public.claimant_idempotency_records from authenticated;
revoke all on table public.claimant_audit_events from public;
revoke all on table public.claimant_audit_events from anon;
revoke all on table public.claimant_audit_events from authenticated;
revoke all on table public.claimant_outbox from public;
revoke all on table public.claimant_outbox from anon;
revoke all on table public.claimant_outbox from authenticated;

grant select, insert on table public.claimant_idempotency_records to service_role;
grant select, insert on table public.claimant_audit_events to service_role;
grant select, insert, update on table public.claimant_outbox to service_role;

alter table public.claimant_idempotency_records enable row level security;
alter table public.claimant_idempotency_records force row level security;
alter table public.claimant_audit_events enable row level security;
alter table public.claimant_audit_events force row level security;
alter table public.claimant_outbox enable row level security;
alter table public.claimant_outbox force row level security;

create policy "Claimant idempotency records are server-only."
on public.claimant_idempotency_records
for all
to anon, authenticated
using (false)
with check (false);

create policy "Claimant audit events are server-only."
on public.claimant_audit_events
for all
to anon, authenticated
using (false)
with check (false);

create policy "Claimant outbox is server-only."
on public.claimant_outbox
for all
to anon, authenticated
using (false)
with check (false);

create function public.claimant_issue_registered_invitation(
  p_owner_user_id uuid,
  p_recipient_address_digest text,
  p_expires_at timestamptz,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_request_digest text;
  v_existing public.claimant_idempotency_records%rowtype;
  v_invitation public.claimant_invitations%rowtype;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'claimant:issue_registered_invitation:' || p_owner_user_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  v_request_digest := encode(
    extensions.digest(
      concat_ws('|', p_owner_user_id::text, p_recipient_address_digest, p_expires_at::text),
      'sha256'
    ),
    'hex'
  );

  select * into v_existing
  from public.claimant_idempotency_records
  where operation = 'issue_registered_invitation'
    and actor_user_id = p_owner_user_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was already used with different invitation input.'
        using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;

  if p_expires_at <= now() then
    raise exception 'Invitation expiry must be in the future.' using errcode = '22023';
  end if;

  insert into public.claimant_invitations (
    owner_user_id,
    recipient_address_digest,
    expires_at
  ) values (
    p_owner_user_id,
    p_recipient_address_digest,
    p_expires_at
  ) returning * into v_invitation;

  insert into public.claimant_audit_events (
    event_type,
    actor_user_id,
    invitation_id,
    idempotency_key,
    metadata
  ) values (
    'registered_invitation_issued',
    p_owner_user_id,
    v_invitation.id,
    p_idempotency_key,
    jsonb_build_object('address_digest_version', v_invitation.address_digest_version)
  );

  insert into public.claimant_outbox (
    topic,
    aggregate_type,
    aggregate_id,
    dedupe_key,
    payload
  ) values (
    'registered_invitation_issued',
    'invitation',
    v_invitation.id,
    'registered_invitation_issued:' || p_idempotency_key::text,
    jsonb_build_object('event', 'registered_invitation_issued')
  );

  v_result := jsonb_build_object(
    'invitation_id', v_invitation.id,
    'invitation_version', v_invitation.version,
    'replayed', false
  );

  insert into public.claimant_idempotency_records (
    operation,
    actor_user_id,
    idempotency_key,
    request_digest,
    result
  ) values (
    'issue_registered_invitation',
    p_owner_user_id,
    p_idempotency_key,
    v_request_digest,
    v_result - 'replayed'
  );

  return v_result;
end
$function$;

create function public.claimant_accept_registered_invitation(
  p_invitation_id uuid,
  p_claimant_user_id uuid,
  p_recipient_address_digest text,
  p_expected_invitation_version integer,
  p_device_binding_digest text,
  p_public_key_jwk jsonb,
  p_policy_pack_id text,
  p_policy_pack_version integer,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_request_digest text;
  v_existing public.claimant_idempotency_records%rowtype;
  v_invitation public.claimant_invitations%rowtype;
  v_identity_status text;
  v_key public.claimant_device_keys%rowtype;
  v_case public.claimant_cases%rowtype;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'claimant:accept_registered_invitation:' || p_claimant_user_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  v_request_digest := encode(
    extensions.digest(
      concat_ws(
        '|',
        p_invitation_id::text,
        p_claimant_user_id::text,
        p_recipient_address_digest,
        p_expected_invitation_version::text,
        p_device_binding_digest,
        p_public_key_jwk::text,
        p_policy_pack_id,
        p_policy_pack_version::text
      ),
      'sha256'
    ),
    'hex'
  );

  select * into v_existing
  from public.claimant_idempotency_records
  where operation = 'accept_registered_invitation'
    and actor_user_id = p_claimant_user_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was already used with different acceptance input.'
        using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;

  select * into v_invitation
  from public.claimant_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Registered-recipient invitation is unavailable.' using errcode = 'P0002';
  end if;

  if v_invitation.version <> p_expected_invitation_version then
    raise exception 'Registered-recipient invitation version is stale.' using errcode = '40001';
  end if;

  if v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then
    raise exception 'Registered-recipient invitation is unavailable.' using errcode = 'P0001';
  end if;

  if v_invitation.recipient_address_digest <> p_recipient_address_digest then
    raise exception 'Registered-recipient invitation binding is invalid.' using errcode = '42501';
  end if;

  if v_invitation.owner_user_id = p_claimant_user_id then
    raise exception 'An owner cannot accept their own registered-recipient invitation.'
      using errcode = '23514';
  end if;

  insert into public.claimant_identities (user_id, status)
  values (p_claimant_user_id, 'active')
  on conflict (user_id) do nothing;

  select status into v_identity_status
  from public.claimant_identities
  where user_id = p_claimant_user_id
  for update;

  if v_identity_status = 'pending' then
    update public.claimant_identities
    set status = 'active', version = version + 1, updated_at = now()
    where user_id = p_claimant_user_id;
  elsif v_identity_status <> 'active' then
    raise exception 'Claimant identity is unavailable.' using errcode = '42501';
  end if;

  insert into public.claimant_device_keys (
    claimant_user_id,
    device_binding_digest,
    public_key_jwk
  ) values (
    p_claimant_user_id,
    p_device_binding_digest,
    p_public_key_jwk
  ) returning * into v_key;

  update public.claimant_invitations
  set
    status = 'accepted',
    accepted_by_user_id = p_claimant_user_id,
    accepted_at = now(),
    version = version + 1,
    updated_at = now()
  where id = p_invitation_id
    and status = 'pending'
    and version = p_expected_invitation_version
  returning * into v_invitation;

  if not found then
    raise exception 'Registered-recipient invitation changed during acceptance.'
      using errcode = '40001';
  end if;

  insert into public.claimant_cases (
    claimant_user_id,
    owner_user_id,
    invitation_id,
    current_key_id,
    policy_pack_id,
    policy_pack_version
  ) values (
    p_claimant_user_id,
    v_invitation.owner_user_id,
    v_invitation.id,
    v_key.id,
    p_policy_pack_id,
    p_policy_pack_version
  ) returning * into v_case;

  insert into public.claimant_audit_events (
    event_type,
    actor_user_id,
    invitation_id,
    case_id,
    idempotency_key,
    metadata
  ) values
    (
      'registered_invitation_accepted',
      p_claimant_user_id,
      v_invitation.id,
      v_case.id,
      p_idempotency_key,
      jsonb_build_object('invitation_version', v_invitation.version)
    ),
    (
      'claimant_key_enrolled',
      p_claimant_user_id,
      v_invitation.id,
      v_case.id,
      p_idempotency_key,
      jsonb_build_object('key_version', v_key.key_version, 'algorithm', v_key.algorithm)
    ),
    (
      'claim_draft_created',
      p_claimant_user_id,
      v_invitation.id,
      v_case.id,
      p_idempotency_key,
      jsonb_build_object('case_version', v_case.version, 'route_profile', v_case.route_profile)
    );

  insert into public.claimant_outbox (
    topic,
    aggregate_type,
    aggregate_id,
    dedupe_key,
    payload
  ) values (
    'registered_recipient_case_created',
    'case',
    v_case.id,
    'registered_recipient_case_created:' || p_idempotency_key::text,
    jsonb_build_object('event', 'registered_recipient_case_created')
  );

  v_result := jsonb_build_object(
    'case_id', v_case.id,
    'case_version', v_case.version,
    'claimant_key_id', v_key.id,
    'invitation_id', v_invitation.id,
    'invitation_version', v_invitation.version,
    'replayed', false
  );

  insert into public.claimant_idempotency_records (
    operation,
    actor_user_id,
    idempotency_key,
    request_digest,
    result
  ) values (
    'accept_registered_invitation',
    p_claimant_user_id,
    p_idempotency_key,
    v_request_digest,
    v_result - 'replayed'
  );

  return v_result;
end
$function$;

revoke all on function public.claimant_issue_registered_invitation(
  uuid,
  text,
  timestamptz,
  uuid
) from public, anon, authenticated;

revoke all on function public.claimant_accept_registered_invitation(
  uuid,
  uuid,
  text,
  integer,
  text,
  jsonb,
  text,
  integer,
  uuid
) from public, anon, authenticated;

grant execute on function public.claimant_issue_registered_invitation(
  uuid,
  text,
  timestamptz,
  uuid
) to service_role;

grant execute on function public.claimant_accept_registered_invitation(
  uuid,
  uuid,
  text,
  integer,
  text,
  jsonb,
  text,
  integer,
  uuid
) to service_role;

revoke all on function public.enforce_vault_assets_active_record_limit()
from public, anon, authenticated;
