create table public.claimant_identities (
  user_id uuid primary key references auth.users(id) on delete restrict,
  status text not null default 'pending' check (
    status in ('pending', 'active', 'suspended', 'closed')
  ),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at)
);

create table public.claimant_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_address_digest text not null check (
    recipient_address_digest ~ '^[0-9a-f]{64}$'
  ),
  address_digest_version integer not null default 1 check (address_digest_version > 0),
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'revoked', 'expired')
  ),
  accepted_by_user_id uuid null references public.claimant_identities(user_id) on delete restrict,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  check (updated_at >= created_at),
  check (expires_at > created_at),
  check (accepted_at is null or accepted_at >= created_at),
  check (revoked_at is null or revoked_at >= created_at),
  constraint claimant_invitations_no_self_accept_check check (
    accepted_by_user_id is null or accepted_by_user_id <> owner_user_id
  ),
  check (
    (
      status = 'pending'
      and accepted_by_user_id is null
      and accepted_at is null
      and revoked_at is null
    )
    or
    (
      status = 'accepted'
      and accepted_by_user_id is not null
      and accepted_at is not null
      and accepted_at <= expires_at
      and revoked_at is null
    )
    or
    (
      status = 'revoked'
      and accepted_by_user_id is null
      and accepted_at is null
      and revoked_at is not null
    )
    or
    (
      status = 'expired'
      and accepted_by_user_id is null
      and accepted_at is null
      and revoked_at is null
    )
  ),
  unique (id, owner_user_id, accepted_by_user_id, status)
);

create unique index claimant_invitations_pending_recipient_idx
on public.claimant_invitations (owner_user_id, recipient_address_digest)
where status = 'pending';

create index claimant_invitations_owner_status_idx
on public.claimant_invitations (owner_user_id, status, created_at desc);

create table public.claimant_device_keys (
  id uuid primary key default gen_random_uuid(),
  claimant_user_id uuid not null references public.claimant_identities(user_id) on delete restrict,
  device_binding_digest text not null check (
    device_binding_digest ~ '^[0-9a-f]{64}$'
  ),
  algorithm text not null default 'p256_ecdh' check (algorithm = 'p256_ecdh'),
  public_key_jwk jsonb not null check (
    jsonb_typeof(public_key_jwk) = 'object'
    and public_key_jwk @> '{"kty":"EC","crv":"P-256"}'::jsonb
    and jsonb_typeof(public_key_jwk -> 'x') = 'string'
    and jsonb_typeof(public_key_jwk -> 'y') = 'string'
    and length(public_key_jwk ->> 'x') = 43
    and length(public_key_jwk ->> 'y') = 43
    and not (public_key_jwk ? 'd')
  ),
  key_version integer not null default 1 check (key_version > 0),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  check (updated_at >= created_at),
  check (revoked_at is null or revoked_at >= created_at),
  check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  ),
  unique (claimant_user_id, device_binding_digest),
  unique (id, claimant_user_id)
);

create index claimant_device_keys_user_status_idx
on public.claimant_device_keys (claimant_user_id, status, created_at desc);

create table public.claimant_cases (
  id uuid primary key default gen_random_uuid(),
  claimant_user_id uuid not null references public.claimant_identities(user_id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  invitation_id uuid not null,
  invitation_status text not null default 'accepted' check (invitation_status = 'accepted'),
  current_key_id uuid not null,
  protocol text not null default 'sanduqkin:claim:state:v1' check (
    protocol = 'sanduqkin:claim:state:v1'
  ),
  route_profile text not null default 'registered_recipient_v1' check (
    route_profile = 'registered_recipient_v1'
  ),
  state text not null default 'draft' check (
    state in (
      'draft',
      'identity_pending',
      'submitted',
      'owner_notified',
      'cooldown',
      'review_pending',
      'approved',
      'release_ready',
      'released',
      'closed',
      'cancelled_by_owner',
      'withdrawn_by_claimant',
      'rejected',
      'expired',
      'on_hold',
      'manual_review',
      'release_suspended'
    )
  ),
  policy_pack_id text not null check (length(policy_pack_id) > 0),
  policy_pack_version integer not null check (policy_pack_version > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at),
  check (claimant_user_id <> owner_user_id),
  unique (invitation_id),
  foreign key (
    invitation_id,
    owner_user_id,
    claimant_user_id,
    invitation_status
  ) references public.claimant_invitations (
    id,
    owner_user_id,
    accepted_by_user_id,
    status
  ) on delete restrict,
  foreign key (current_key_id, claimant_user_id)
    references public.claimant_device_keys (id, claimant_user_id)
    on delete restrict
);

create index claimant_cases_claimant_state_idx
on public.claimant_cases (claimant_user_id, state, updated_at desc);

create index claimant_cases_owner_state_idx
on public.claimant_cases (owner_user_id, state, updated_at desc);

revoke all on table public.claimant_identities from public;
revoke all on table public.claimant_identities from anon;
revoke all on table public.claimant_identities from authenticated;
revoke all on table public.claimant_invitations from public;
revoke all on table public.claimant_invitations from anon;
revoke all on table public.claimant_invitations from authenticated;
revoke all on table public.claimant_device_keys from public;
revoke all on table public.claimant_device_keys from anon;
revoke all on table public.claimant_device_keys from authenticated;
revoke all on table public.claimant_cases from public;
revoke all on table public.claimant_cases from anon;
revoke all on table public.claimant_cases from authenticated;

grant all on table public.claimant_identities to service_role;
grant all on table public.claimant_invitations to service_role;
grant all on table public.claimant_device_keys to service_role;
grant all on table public.claimant_cases to service_role;

alter table public.claimant_identities enable row level security;
alter table public.claimant_identities force row level security;
alter table public.claimant_invitations enable row level security;
alter table public.claimant_invitations force row level security;
alter table public.claimant_device_keys enable row level security;
alter table public.claimant_device_keys force row level security;
alter table public.claimant_cases enable row level security;
alter table public.claimant_cases force row level security;

create policy "Claimant identities are server-only."
on public.claimant_identities
for all
to anon, authenticated
using (false)
with check (false);

create policy "Claimant invitations are server-only."
on public.claimant_invitations
for all
to anon, authenticated
using (false)
with check (false);

create policy "Claimant device keys are server-only."
on public.claimant_device_keys
for all
to anon, authenticated
using (false)
with check (false);

create policy "Claimant cases are server-only."
on public.claimant_cases
for all
to anon, authenticated
using (false)
with check (false);
