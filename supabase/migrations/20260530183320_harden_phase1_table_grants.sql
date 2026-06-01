revoke all on table public.vault_key_material from anon;
revoke all on table public.vault_key_material from authenticated;
revoke all on table public.vault_key_material from public;

revoke all on table public.vault_assets from anon;
revoke all on table public.vault_assets from authenticated;
revoke all on table public.vault_assets from public;

revoke all on table public.audit_events from anon;
revoke all on table public.audit_events from authenticated;
revoke all on table public.audit_events from public;

grant select, insert, update on table public.vault_key_material to authenticated;
grant select, insert, update, delete on table public.vault_assets to authenticated;
grant select, insert on table public.audit_events to authenticated;

grant all on table public.vault_key_material to service_role;
grant all on table public.vault_assets to service_role;
grant all on table public.audit_events to service_role;
