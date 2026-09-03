alter table public.claimant_native_enrollment_rate_limits
drop constraint claimant_native_enrollment_rate_limits_action_check;
alter table public.claimant_native_enrollment_rate_limits
add constraint claimant_native_enrollment_rate_limits_action_check check (action in (
  'registration_issue', 'registration_complete', 'native_issue', 'native_complete', 'native_reconcile'
));

create or replace function public.claimant_take_native_enrollment_rate_limit(
  p_claimant_user_id uuid, p_portal_session_id uuid, p_action text
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_window timestamptz := date_bin(interval '15 minutes', now(), timestamptz '2020-01-01 00:00:00+00');
  v_attempts integer; v_limit integer;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  v_limit := case p_action
    when 'registration_issue' then 5 when 'registration_complete' then 10
    when 'native_issue' then 5 when 'native_complete' then 10
    when 'native_reconcile' then 20 else null end;
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

create function public.claimant_reconcile_native_enrollment(
  p_claimant_user_id uuid,
  p_portal_session_id uuid,
  p_attempt_id uuid,
  p_native_challenge_id uuid,
  p_app_attest_challenge_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_native public.claimant_native_enrollment_challenges%rowtype;
  v_app public.claimant_app_attest_challenges%rowtype;
  v_existing public.claimant_idempotency_records%rowtype;
  v_result jsonb;
begin
  perform public.claimant_assert_portal_session(p_claimant_user_id, p_portal_session_id);
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:native-enrollment-challenge:' || p_native_challenge_id::text,
    0
  ));

  select * into v_native
  from public.claimant_native_enrollment_challenges
  where id = p_native_challenge_id
    and claimant_user_id = p_claimant_user_id
  for update;

  select * into v_app
  from public.claimant_app_attest_challenges
  where id = p_app_attest_challenge_id
    and claimant_user_id = p_claimant_user_id
  for update;

  if v_native.id is null or v_app.id is null
    or v_native.app_attest_assertion_challenge_id <> v_app.id
    or v_native.portal_session_id <> v_app.portal_session_id
    or v_app.purpose <> 'native_enrollment_assertion' then
    return jsonb_build_object('status', 'unknown');
  end if;

  select * into v_existing
  from public.claimant_idempotency_records
  where operation = 'accept_native_enrollment'
    and actor_user_id = p_claimant_user_id
    and idempotency_key = p_attempt_id;

  if found then
    v_result := v_existing.result;
    if v_native.status <> 'consumed' or v_app.status <> 'consumed'
      or (v_result ->> 'claimant_key_id')::uuid <> v_native.claimant_key_id
      or (v_result ->> 'invitation_id')::uuid <> v_native.invitation_id then
      return jsonb_build_object('status', 'unknown');
    end if;
    return jsonb_build_object('status', 'committed', 'result', v_result || jsonb_build_object('replayed', true));
  end if;

  if v_native.status = 'consumed' or v_app.status = 'consumed' then
    return jsonb_build_object('status', 'unknown');
  end if;

  update public.claimant_native_enrollment_challenges
  set status = 'expired'
  where id = v_native.id and status = 'issued';
  update public.claimant_app_attest_challenges
  set status = 'expired'
  where id = v_app.id and status = 'issued';

  return jsonb_build_object('status', 'not_committed');
end
$function$;

revoke all on function public.claimant_reconcile_native_enrollment(uuid, uuid, uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.claimant_reconcile_native_enrollment(uuid, uuid, uuid, uuid, uuid)
to service_role;
