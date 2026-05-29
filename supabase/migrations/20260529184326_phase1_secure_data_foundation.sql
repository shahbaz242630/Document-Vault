create extension if not exists pgcrypto with schema extensions;

create table public.vault_key_material (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  wrapped_mek_ciphertext text not null check (length(wrapped_mek_ciphertext) > 0),
  wrapped_mek_nonce text not null check (length(wrapped_mek_nonce) > 0),
  kek_salt text not null check (length(kek_salt) > 0),
  kdf_algorithm text not null default 'argon2id' check (kdf_algorithm = 'argon2id'),
  kdf_params jsonb not null default '{"opslimit":3,"memlimit":268435456,"keyLength":32}'::jsonb,
  recovery_version integer not null default 1 check (recovery_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vault_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  asset_type text not null check (
    asset_type in (
      'bank_account',
      'investment',
      'property',
      'insurance',
      'crypto',
      'pension',
      'subscription',
      'document_location',
      'contact',
      'other'
    )
  ),
  ciphertext text not null check (length(ciphertext) > 0),
  nonce text not null check (length(nonce) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  check (updated_at >= created_at),
  check (deleted_at is null or deleted_at >= created_at)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in (
      'sign_in_attempt',
      'sign_in_success',
      'sign_in_failure',
      'sign_up_attempt',
      'sign_up_success',
      'vault_unlocked',
      'vault_locked',
      'asset_created',
      'asset_updated',
      'asset_soft_deleted',
      'asset_restored',
      'asset_permanently_deleted',
      'account_deletion_requested',
      'account_deletion_completed'
    )
  ),
  occurred_at timestamptz not null default now(),
  device_info text not null check (length(device_info) > 0),
  ip_address inet null,
  metadata jsonb not null default '{}'::jsonb,
  user_email_hash text null
);

create index vault_assets_user_id_idx on public.vault_assets (user_id);
create index vault_assets_user_id_deleted_at_idx on public.vault_assets (user_id, deleted_at);
create index vault_assets_user_id_asset_type_idx on public.vault_assets (user_id, asset_type);
create index audit_events_user_id_occurred_at_idx on public.audit_events (user_id, occurred_at desc);

grant select, insert, update on table public.vault_key_material to authenticated;
grant select, insert, update, delete on table public.vault_assets to authenticated;
grant select, insert on table public.audit_events to authenticated;

grant all on table public.vault_key_material to service_role;
grant all on table public.vault_assets to service_role;
grant all on table public.audit_events to service_role;

alter table public.vault_key_material enable row level security;
alter table public.vault_assets enable row level security;
alter table public.audit_events enable row level security;

create policy "Users can read their own key material."
on public.vault_key_material
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create their own key material."
on public.vault_key_material
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own key material."
on public.vault_key_material
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can read their own vault assets."
on public.vault_assets
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create their own vault assets."
on public.vault_assets
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own vault assets."
on public.vault_assets
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete their own vault assets."
on public.vault_assets
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can read their own audit events."
on public.audit_events
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create their own audit events."
on public.audit_events
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
