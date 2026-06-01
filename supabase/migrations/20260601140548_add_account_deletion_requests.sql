create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'pending' check (
    status in (
      'pending',
      'processing',
      'completed',
      'cancelled'
    )
  ),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '30 days'),
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_for >= requested_at),
  check (completed_at is null or completed_at >= requested_at)
);

create index account_deletion_requests_user_id_requested_at_idx
on public.account_deletion_requests (user_id, requested_at desc);

create unique index account_deletion_requests_one_open_request_idx
on public.account_deletion_requests (user_id)
where status in ('pending', 'processing');

revoke all on table public.account_deletion_requests from anon;
revoke all on table public.account_deletion_requests from public;

grant select, insert on table public.account_deletion_requests to authenticated;
grant all on table public.account_deletion_requests to service_role;

alter table public.account_deletion_requests enable row level security;

create policy "Users can read their own account deletion request."
on public.account_deletion_requests
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create their own account deletion request."
on public.account_deletion_requests
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
