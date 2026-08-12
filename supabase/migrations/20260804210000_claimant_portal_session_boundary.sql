alter table public.claimant_idempotency_records
drop constraint claimant_idempotency_records_operation_check;

alter table public.claimant_idempotency_records
add constraint claimant_idempotency_records_operation_check check (
  operation in (
    'issue_registered_invitation', 'accept_registered_invitation',
    'activate_claimant_session', 'revoke_claimant_session',
    'activate_claimant_portal_session', 'revoke_claimant_portal_session',
    'revoke_registered_invitation', 'lifecycle_enroll', 'lifecycle_replace',
    'lifecycle_revoke', 'lifecycle_finalize'
  )
);

create table public.claimant_portal_eligibilities (
  user_id uuid primary key references auth.users(id) on delete restrict,
  status text not null check (status in ('eligible', 'revoked')),
  source text not null check (source = 'synthetic_fixture'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  check (
    (status = 'eligible' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create table public.claimant_portal_session_controls (
  user_id uuid primary key references public.claimant_portal_eligibilities(user_id) on delete restrict,
  active_session_id uuid not null,
  status text not null check (status in ('active', 'revoked')),
  assurance_level text not null check (assurance_level = 'aal2'),
  authenticated_at timestamptz not null,
  activated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  check (authenticated_at <= activated_at + interval '1 minute'),
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null))
);

create table public.claimant_portal_session_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in ('portal_session_activated', 'portal_session_displaced', 'portal_session_revoked')
  ),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  session_id uuid not null,
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and not (metadata ?| array['token', 'email', 'address', 'recovery_secret', 'invitation'])
  ),
  unique (actor_user_id, idempotency_key, event_type)
);

revoke all on table public.claimant_portal_eligibilities from public;
revoke all on table public.claimant_portal_eligibilities from anon;
revoke all on table public.claimant_portal_eligibilities from authenticated;
revoke all on table public.claimant_portal_session_controls from public;
revoke all on table public.claimant_portal_session_controls from anon;
revoke all on table public.claimant_portal_session_controls from authenticated;
revoke all on table public.claimant_portal_session_events from public;
revoke all on table public.claimant_portal_session_events from anon;
revoke all on table public.claimant_portal_session_events from authenticated;
grant select on table public.claimant_portal_eligibilities to service_role;
grant select, insert, update on table public.claimant_portal_session_controls to service_role;
grant select, insert on table public.claimant_portal_session_events to service_role;

alter table public.claimant_portal_eligibilities enable row level security;
alter table public.claimant_portal_eligibilities force row level security;
alter table public.claimant_portal_session_controls enable row level security;
alter table public.claimant_portal_session_controls force row level security;
alter table public.claimant_portal_session_events enable row level security;
alter table public.claimant_portal_session_events force row level security;

create policy "Claimant portal eligibility is server-only."
on public.claimant_portal_eligibilities for all to anon, authenticated using (false) with check (false);
create policy "Claimant portal sessions are server-only."
on public.claimant_portal_session_controls for all to anon, authenticated using (false) with check (false);
create policy "Claimant portal session events are server-only."
on public.claimant_portal_session_events for all to anon, authenticated using (false) with check (false);

create function public.claimant_activate_portal_session(
  p_user_id uuid, p_session_id uuid, p_authenticated_at timestamptz, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_eligibility public.claimant_portal_eligibilities%rowtype;
  v_control public.claimant_portal_session_controls%rowtype;
  v_existing public.claimant_idempotency_records%rowtype;
  v_displaced boolean := false;
  v_digest text;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:portal-session:' || p_user_id::text, 0));
  select * into v_eligibility from public.claimant_portal_eligibilities where user_id = p_user_id;
  if not found or v_eligibility.status <> 'eligible' or v_eligibility.source <> 'synthetic_fixture' then
    raise exception 'Claimant portal is unavailable.' using errcode = '42501';
  end if;
  if p_authenticated_at < now() - interval '10 minutes' or p_authenticated_at > now() + interval '1 minute' then
    raise exception 'Fresh authentication is required.' using errcode = '28000';
  end if;
  v_digest := encode(extensions.digest(concat_ws(
    '|', p_user_id::text, p_session_id::text, p_authenticated_at::text, v_eligibility.version::text
  ), 'sha256'), 'hex');
  select * into v_existing from public.claimant_idempotency_records
  where operation = 'activate_claimant_portal_session'
    and actor_user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Idempotency key input changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_control from public.claimant_portal_session_controls
  where user_id = p_user_id for update;
  if found and v_control.status = 'active' and v_control.active_session_id <> p_session_id then
    v_displaced := true;
  end if;
  insert into public.claimant_portal_session_controls (
    user_id, active_session_id, status, assurance_level, authenticated_at
  ) values (p_user_id, p_session_id, 'active', 'aal2', p_authenticated_at)
  on conflict (user_id) do update set
    active_session_id = excluded.active_session_id, status = 'active', assurance_level = 'aal2',
    authenticated_at = excluded.authenticated_at, activated_at = now(), revoked_at = null,
    version = public.claimant_portal_session_controls.version + 1, updated_at = now()
  returning * into v_control;
  insert into public.claimant_portal_session_events (
    event_type, actor_user_id, session_id, idempotency_key, metadata
  ) values (
    case when v_displaced then 'portal_session_displaced' else 'portal_session_activated' end,
    p_user_id, p_session_id, p_idempotency_key,
    jsonb_build_object('session_version', v_control.version, 'eligibility_version', v_eligibility.version)
  );
  v_result := jsonb_build_object(
    'context', 'claimant_portal', 'session_version', v_control.version,
    'displaced_previous', v_displaced, 'replayed', false
  );
  insert into public.claimant_idempotency_records (
    operation, actor_user_id, idempotency_key, request_digest, result
  ) values ('activate_claimant_portal_session', p_user_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end
$function$;

create function public.claimant_assert_portal_session(p_user_id uuid, p_session_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $function$
declare
  v_control public.claimant_portal_session_controls%rowtype;
begin
  if not exists (
    select 1 from public.claimant_portal_eligibilities
    where user_id = p_user_id and status = 'eligible' and source = 'synthetic_fixture'
  ) then
    raise exception 'Claimant portal is unavailable.' using errcode = '42501';
  end if;
  select * into v_control from public.claimant_portal_session_controls where user_id = p_user_id;
  if not found or v_control.status <> 'active' or v_control.active_session_id <> p_session_id then
    raise exception 'Claimant portal session is inactive.' using errcode = '28000';
  end if;
  return jsonb_build_object('context', 'claimant_portal', 'session_version', v_control.version);
end
$function$;

create function public.claimant_revoke_portal_session(
  p_user_id uuid, p_session_id uuid, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_control public.claimant_portal_session_controls%rowtype;
  v_digest text := encode(extensions.digest(p_user_id::text || '|' || p_session_id::text, 'sha256'), 'hex');
  v_existing public.claimant_idempotency_records%rowtype;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:portal-session:' || p_user_id::text, 0));
  select * into v_existing from public.claimant_idempotency_records
  where operation = 'revoke_claimant_portal_session'
    and actor_user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Idempotency key input changed.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  update public.claimant_portal_session_controls set
    status = 'revoked', revoked_at = now(), version = version + 1, updated_at = now()
  where user_id = p_user_id and active_session_id = p_session_id and status = 'active'
  returning * into v_control;
  if not found then
    raise exception 'Claimant portal session is inactive.' using errcode = '28000';
  end if;
  insert into public.claimant_portal_session_events (
    event_type, actor_user_id, session_id, idempotency_key, metadata
  ) values (
    'portal_session_revoked', p_user_id, p_session_id, p_idempotency_key,
    jsonb_build_object('session_version', v_control.version)
  );
  v_result := jsonb_build_object(
    'context', 'claimant_portal', 'session_version', v_control.version,
    'revoked', true, 'replayed', false
  );
  insert into public.claimant_idempotency_records (
    operation, actor_user_id, idempotency_key, request_digest, result
  ) values ('revoke_claimant_portal_session', p_user_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end
$function$;

revoke all on function public.claimant_activate_portal_session(uuid, uuid, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.claimant_assert_portal_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claimant_revoke_portal_session(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claimant_activate_portal_session(uuid, uuid, timestamptz, uuid) to service_role;
grant execute on function public.claimant_assert_portal_session(uuid, uuid) to service_role;
grant execute on function public.claimant_revoke_portal_session(uuid, uuid, uuid) to service_role;
