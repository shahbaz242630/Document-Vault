create table public.claimant_native_enrollment_rate_limits (
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in (
    'registration_issue', 'registration_complete', 'native_issue', 'native_complete'
  )),
  window_started_at timestamptz not null,
  attempts integer not null default 1 check (attempts between 1 and 100),
  updated_at timestamptz not null default now(),
  primary key (claimant_user_id, action, window_started_at)
);

create index claimant_native_enrollment_rate_limits_expiry_idx
on public.claimant_native_enrollment_rate_limits (window_started_at);

revoke all on table public.claimant_native_enrollment_rate_limits from public;
revoke all on table public.claimant_native_enrollment_rate_limits from anon;
revoke all on table public.claimant_native_enrollment_rate_limits from authenticated;
grant select, insert, update, delete on table public.claimant_native_enrollment_rate_limits to service_role;
alter table public.claimant_native_enrollment_rate_limits enable row level security;
alter table public.claimant_native_enrollment_rate_limits force row level security;
create policy "Claimant native enrollment rate limits are server-only."
on public.claimant_native_enrollment_rate_limits for all to anon, authenticated
using (false) with check (false);

create function public.claimant_take_native_enrollment_rate_limit(
  p_claimant_user_id uuid, p_portal_session_id uuid, p_action text
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_window timestamptz := date_bin(interval '15 minutes', now(), timestamptz '2020-01-01 00:00:00+00');
  v_attempts integer; v_limit integer;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  v_limit := case p_action
    when 'registration_issue' then 5 when 'registration_complete' then 10
    when 'native_issue' then 5 when 'native_complete' then 10 else null end;
  if v_limit is null then raise exception 'Native enrollment rate-limit action is invalid.' using errcode = '22023'; end if;
  insert into public.claimant_native_enrollment_rate_limits (
    claimant_user_id, action, window_started_at, attempts
  ) values (p_claimant_user_id, p_action, v_window, 1)
  on conflict (claimant_user_id, action, window_started_at) do update set
    attempts = public.claimant_native_enrollment_rate_limits.attempts + 1, updated_at = now()
  returning attempts into v_attempts;
  if v_attempts > v_limit then
    raise exception 'Native enrollment request limit exceeded.' using errcode = 'P0001';
  end if;
  return jsonb_build_object('allowed', true, 'remaining', v_limit - v_attempts,
    'retry_after_seconds', greatest(1, extract(epoch from (v_window + interval '15 minutes' - now()))::integer));
end
$function$;

create function public.claimant_get_native_enrollment_authority(
  p_claimant_user_id uuid, p_portal_session_id uuid, p_invitation_id uuid,
  p_recipient_address_digest text, p_app_attest_key_id_digest text
) returns jsonb language plpgsql stable security invoker set search_path = '' as $function$
declare v_eligibility public.claimant_portal_eligibilities%rowtype;
  v_invitation public.claimant_invitations%rowtype;
  v_app_key public.claimant_app_attest_keys%rowtype;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  select * into v_eligibility from public.claimant_portal_eligibilities
    where user_id = p_claimant_user_id and status = 'eligible' and source = 'synthetic_fixture';
  select * into v_invitation from public.claimant_invitations
    where id = p_invitation_id and status = 'pending' and expires_at > now()
      and recipient_address_digest = p_recipient_address_digest
      and owner_user_id <> p_claimant_user_id;
  select * into v_app_key from public.claimant_app_attest_keys
    where claimant_user_id = p_claimant_user_id
      and app_attest_key_id_digest = p_app_attest_key_id_digest and status = 'active';
  if v_eligibility.user_id is null or v_invitation.id is null or v_app_key.id is null then
    raise exception 'Native enrollment authority is unavailable.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'eligibility_version', v_eligibility.version,
    'invitation_id', v_invitation.id,
    'invitation_version', v_invitation.version,
    'recipient_address_digest', v_invitation.recipient_address_digest
  );
end
$function$;

revoke all on function public.claimant_take_native_enrollment_rate_limit(uuid, uuid, text)
from public, anon, authenticated;
revoke all on function public.claimant_get_native_enrollment_authority(uuid, uuid, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.claimant_take_native_enrollment_rate_limit(uuid, uuid, text)
to service_role;
grant execute on function public.claimant_get_native_enrollment_authority(uuid, uuid, uuid, text, text)
to service_role;
