revoke all on table public.account_deletion_requests from authenticated;
grant select, insert on table public.account_deletion_requests to authenticated;

revoke all on table public.emergency_contacts from authenticated;
grant select, insert, update on table public.emergency_contacts to authenticated;

revoke all on table public.emergency_key_grants from authenticated;
grant select, insert, update on table public.emergency_key_grants to authenticated;

revoke all on table public.emergency_release_requests from authenticated;
grant select, insert on table public.emergency_release_requests to authenticated;
