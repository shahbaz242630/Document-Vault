alter table public.account_deletion_requests
drop constraint account_deletion_requests_status_check;

alter table public.account_deletion_requests
add constraint account_deletion_requests_status_check
check (
  status in (
    'pending',
    'processing',
    'completed',
    'cancelled',
    'failed'
  )
);

alter table public.account_deletion_requests
add column attempt_count integer not null default 0 check (attempt_count >= 0),
add column last_error text null;
