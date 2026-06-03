create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (length(label) > 0),
  contact_email_hash text null check (contact_email_hash is null or length(contact_email_hash) > 0),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  check (updated_at >= created_at),
  check (revoked_at is null or revoked_at >= created_at)
);

create table public.emergency_key_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid null references public.emergency_contacts(id) on delete set null,
  grant_type text not null check (grant_type in ('pre_authorized_kin', 'sealed_emergency_code')),
  status text not null default 'active' check (status in ('active', 'revoked', 'released')),
  wrapped_mek_ciphertext text not null check (length(wrapped_mek_ciphertext) > 0),
  wrapped_mek_nonce text not null check (length(wrapped_mek_nonce) > 0),
  wrapping_algorithm text not null default 'xchacha20poly1305_ietf' check (wrapping_algorithm = 'xchacha20poly1305_ietf'),
  kdf_algorithm text null check (kdf_algorithm is null or kdf_algorithm = 'argon2id'),
  kdf_salt text null check (kdf_salt is null or length(kdf_salt) > 0),
  kdf_params jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_at timestamptz null,
  revoked_at timestamptz null,
  check (updated_at >= created_at),
  check (released_at is null or released_at >= created_at),
  check (revoked_at is null or revoked_at >= created_at),
  check (
    (grant_type = 'sealed_emergency_code' and kdf_algorithm = 'argon2id' and kdf_salt is not null and kdf_params is not null)
    or
    (grant_type = 'pre_authorized_kin' and kdf_algorithm is null and kdf_salt is null and kdf_params is null)
  )
);

create table public.emergency_release_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_grant_id uuid not null references public.emergency_key_grants(id) on delete cascade,
  status text not null default 'submitted' check (
    status in ('submitted', 'under_review', 'approved', 'rejected', 'cancelled', 'released')
  ),
  requester_email_hash text null check (requester_email_hash is null or length(requester_email_hash) > 0),
  verification_metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  released_at timestamptz null,
  cancelled_at timestamptz null,
  check (reviewed_at is null or reviewed_at >= submitted_at),
  check (released_at is null or released_at >= submitted_at),
  check (cancelled_at is null or cancelled_at >= submitted_at)
);

create index emergency_contacts_user_id_idx on public.emergency_contacts (user_id);
create index emergency_key_grants_user_id_idx on public.emergency_key_grants (user_id);
create index emergency_key_grants_contact_id_idx on public.emergency_key_grants (contact_id);
create index emergency_release_requests_user_id_idx on public.emergency_release_requests (user_id);
create index emergency_release_requests_key_grant_id_idx on public.emergency_release_requests (key_grant_id);

grant select, insert, update on table public.emergency_contacts to authenticated;
grant select, insert, update on table public.emergency_key_grants to authenticated;
grant select, insert on table public.emergency_release_requests to authenticated;

grant all on table public.emergency_contacts to service_role;
grant all on table public.emergency_key_grants to service_role;
grant all on table public.emergency_release_requests to service_role;

alter table public.emergency_contacts enable row level security;
alter table public.emergency_key_grants enable row level security;
alter table public.emergency_release_requests enable row level security;

create policy "Users can read their own emergency contacts."
on public.emergency_contacts
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create their own emergency contacts."
on public.emergency_contacts
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own emergency contacts."
on public.emergency_contacts
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can read their own emergency key grants."
on public.emergency_key_grants
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create their own emergency key grants."
on public.emergency_key_grants
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own emergency key grants."
on public.emergency_key_grants
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can read their own emergency release requests."
on public.emergency_release_requests
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create their own emergency release requests."
on public.emergency_release_requests
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
