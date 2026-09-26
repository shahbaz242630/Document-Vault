-- Slice 6J: the owner's "My emergency sheets" list. One service-only, read-only function returns the owner's own
-- sheets with dates and a status only: never the locator digest, commitment, proof key, wrap, salt, grant or
-- attempt counters. An active sheet past its expiry is reported as expired without changing the row.
create function public.claimant_list_offline_code_v2_locators(p_owner_user_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $function$
  select jsonb_build_object('sheets', coalesce(jsonb_agg(jsonb_build_object(
      'locator_record_id', l.id,
      'status', case when l.status = 'active' and l.expires_at <= now() then 'expired' else l.status end,
      'issued_at', l.issued_at, 'expires_at', l.expires_at, 'revoked_at', l.revoked_at)
    order by l.issued_at desc, l.id), '[]'::jsonb),
    'synthetic_only', true, 'claim_created', false, 'release_authorized', false)
  from (select id, status, issued_at, expires_at, revoked_at
    from public.claimant_offline_code_v2_locators
    where owner_user_id = p_owner_user_id
    order by issued_at desc, id limit 50) l;
$function$;

revoke all on function public.claimant_list_offline_code_v2_locators(uuid) from public, anon, authenticated;
grant execute on function public.claimant_list_offline_code_v2_locators(uuid) to service_role;
