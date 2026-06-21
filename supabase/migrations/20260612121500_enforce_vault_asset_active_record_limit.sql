create or replace function public.enforce_vault_assets_active_record_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  active_record_count integer;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  select count(*)
  into active_record_count
  from public.vault_assets
  where user_id = new.user_id
    and asset_type = new.asset_type
    and deleted_at is null
    and id <> new.id;

  if active_record_count >= 20 then
    raise exception 'vault_assets active record limit exceeded for asset type'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists vault_assets_active_record_limit_trigger on public.vault_assets;

create trigger vault_assets_active_record_limit_trigger
before insert or update of user_id, asset_type, deleted_at
on public.vault_assets
for each row
execute function public.enforce_vault_assets_active_record_limit();
