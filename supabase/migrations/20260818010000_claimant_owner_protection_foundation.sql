alter table public.claimant_outbox drop constraint claimant_outbox_topic_check;
alter table public.claimant_outbox add constraint claimant_outbox_topic_check check (topic in (
  'registered_invitation_issued', 'registered_invitation_revoked',
  'registered_recipient_case_created', 'registered_recipient_binding_invalidated',
  'registered_recipient_finalized', 'claim_submission_received',
  'owner_notice_requested', 'owner_notice_delivery_verified',
  'owner_protection_held', 'owner_protection_cancelled'
));

alter table public.claimant_cases add constraint claimant_cases_owner_protection_binding_unique
unique (id, owner_user_id, claimant_user_id, policy_pack_id, policy_pack_version);

create table public.claimant_owner_protection_cycles (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  claimant_user_id uuid not null references public.claimant_identities(user_id) on delete restrict,
  policy_pack_id text not null,
  policy_pack_version integer not null check (policy_pack_version > 0),
  submission_case_version integer not null check (submission_case_version > 1),
  cycle_number integer not null check (cycle_number > 0),
  notice_ref text not null unique check (notice_ref ~ '^synthetic_owner_notice_[a-z0-9_]{1,100}$'),
  status text not null check (status in (
    'pending_delivery', 'delivery_verified', 'delivery_failed', 'delivery_ambiguous',
    'invalidated', 'cancelled', 'disputed'
  )),
  cooldown_seconds integer not null check (cooldown_seconds between 86400 and 7776000),
  delivery_evidence_digest text null check (
    delivery_evidence_digest is null or delivery_evidence_digest ~ '^[0-9a-f]{64}$'
  ),
  terminal_reason text null check (terminal_reason is null or terminal_reason in (
    'delivery_failed', 'delivery_ambiguous', 'material_change',
    'conflicting_authority', 'owner_cancelled', 'claimant_dispute'
  )),
  requested_at timestamptz not null default now(),
  delivery_verified_at timestamptz null,
  cooldown_started_at timestamptz null,
  cooldown_expires_at timestamptz null,
  terminal_at timestamptz null,
  updated_at timestamptz not null default now(),
  check (updated_at >= requested_at),
  check (cooldown_expires_at is null or cooldown_expires_at > cooldown_started_at),
  check (
    (status = 'pending_delivery' and delivery_evidence_digest is null
      and delivery_verified_at is null and cooldown_started_at is null
      and cooldown_expires_at is null and terminal_reason is null and terminal_at is null)
    or
    (status = 'delivery_verified' and delivery_evidence_digest is not null
      and delivery_verified_at is not null and cooldown_started_at = delivery_verified_at
      and cooldown_expires_at = cooldown_started_at + make_interval(secs => cooldown_seconds)
      and terminal_reason is null and terminal_at is null)
    or
    (status in ('delivery_failed', 'delivery_ambiguous') and delivery_evidence_digest is null
      and delivery_verified_at is null and cooldown_started_at is null
      and cooldown_expires_at is null and terminal_reason = status and terminal_at is not null)
    or
    (status in ('invalidated', 'cancelled', 'disputed') and terminal_reason is not null
      and terminal_at is not null)
  ),
  unique (case_id, cycle_number),
  unique (id, case_id),
  foreign key (case_id, owner_user_id, claimant_user_id, policy_pack_id, policy_pack_version)
    references public.claimant_cases
      (id, owner_user_id, claimant_user_id, policy_pack_id, policy_pack_version)
    on delete restrict,
  foreign key (case_id) references public.claimant_submission_receipts(case_id) on delete restrict
);

create unique index claimant_owner_protection_active_cycle_idx
on public.claimant_owner_protection_cycles (case_id)
where status in ('pending_delivery', 'delivery_verified');

create table public.claimant_owner_protection_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  cycle_id uuid not null,
  event_type text not null check (event_type in (
    'owner_notice_requested', 'owner_notice_delivery_verified',
    'owner_notice_delivery_failed', 'owner_notice_delivery_ambiguous',
    'owner_protection_invalidated', 'owner_protection_cancelled', 'owner_protection_disputed'
  )),
  actor_class text not null check (actor_class in ('system', 'owner', 'claimant')),
  actor_user_id uuid null references auth.users(id) on delete restrict,
  reason_class text not null check (reason_class in (
    'not_applicable', 'delivery_failed', 'delivery_ambiguous', 'material_change',
    'conflicting_authority', 'owner_cancelled', 'claimant_dispute'
  )),
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  check ((actor_class = 'system' and actor_user_id is null)
    or (actor_class in ('owner', 'claimant') and actor_user_id is not null)),
  unique (case_id, idempotency_key, event_type),
  foreign key (cycle_id, case_id)
    references public.claimant_owner_protection_cycles(id, case_id) on delete restrict
);

create table public.claimant_owner_protection_idempotency (
  operation text not null check (operation in (
    'begin_owner_notice', 'record_owner_notice_delivery', 'stop_owner_protection'
  )),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (operation, case_id, idempotency_key)
);

revoke all on table public.claimant_owner_protection_cycles from public;
revoke all on table public.claimant_owner_protection_cycles from anon;
revoke all on table public.claimant_owner_protection_cycles from authenticated;
revoke all on table public.claimant_owner_protection_events from public;
revoke all on table public.claimant_owner_protection_events from anon;
revoke all on table public.claimant_owner_protection_events from authenticated;
revoke all on table public.claimant_owner_protection_idempotency from public;
revoke all on table public.claimant_owner_protection_idempotency from anon;
revoke all on table public.claimant_owner_protection_idempotency from authenticated;
grant select, insert, update on table public.claimant_owner_protection_cycles to service_role;
grant select, insert on table public.claimant_owner_protection_events to service_role;
grant select, insert on table public.claimant_owner_protection_idempotency to service_role;
alter table public.claimant_owner_protection_cycles enable row level security;
alter table public.claimant_owner_protection_cycles force row level security;
alter table public.claimant_owner_protection_events enable row level security;
alter table public.claimant_owner_protection_events force row level security;
alter table public.claimant_owner_protection_idempotency enable row level security;
alter table public.claimant_owner_protection_idempotency force row level security;
create policy "Claimant owner-protection cycles are server-only."
on public.claimant_owner_protection_cycles for all to anon, authenticated using (false) with check (false);
create policy "Claimant owner-protection events are server-only."
on public.claimant_owner_protection_events for all to anon, authenticated using (false) with check (false);
create policy "Claimant owner-protection idempotency is server-only."
on public.claimant_owner_protection_idempotency for all to anon, authenticated using (false) with check (false);

create function public.claimant_begin_owner_notice(
  p_case_id uuid, p_expected_case_version integer, p_notice_ref text,
  p_cooldown_seconds integer, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype; v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_existing public.claimant_owner_protection_idempotency%rowtype;
  v_digest text; v_result jsonb; v_cycle_number integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:owner-protection:' || p_case_id::text, 0));
  if p_expected_case_version < 2 or p_notice_ref !~ '^synthetic_owner_notice_[a-z0-9_]{1,100}$'
    or p_cooldown_seconds not between 86400 and 7776000 then
    raise exception 'Owner notice input is invalid.' using errcode = '22023';
  end if;
  v_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_expected_case_version::text, p_notice_ref, p_cooldown_seconds::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_owner_protection_idempotency
  where operation = 'begin_owner_notice' and case_id = p_case_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Idempotency key was used with different owner-notice input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  if v_case.id is null or v_case.state <> 'submitted' or v_case.version <> p_expected_case_version
    or not exists (select 1 from public.claimant_submission_receipts
      where case_id = p_case_id and case_version = p_expected_case_version
        and review_started = false and release_authorized = false) then
    raise exception 'Owner notice case is unavailable.' using errcode = '40001';
  end if;
  if exists (select 1 from public.claimant_owner_protection_cycles where case_id = p_case_id
      and status in ('pending_delivery', 'delivery_verified')) then
    raise exception 'Owner protection is already active.' using errcode = '40001';
  end if;
  select coalesce(max(cycle_number), 0) + 1 into v_cycle_number
  from public.claimant_owner_protection_cycles where case_id = p_case_id;
  insert into public.claimant_owner_protection_cycles (case_id, owner_user_id, claimant_user_id,
    policy_pack_id, policy_pack_version, submission_case_version, cycle_number, notice_ref,
    status, cooldown_seconds)
  values (p_case_id, v_case.owner_user_id, v_case.claimant_user_id, v_case.policy_pack_id,
    v_case.policy_pack_version, v_case.version, v_cycle_number, p_notice_ref,
    'pending_delivery', p_cooldown_seconds) returning * into v_cycle;
  update public.claimant_cases set state = 'owner_notified', version = version + 1, updated_at = now()
  where id = p_case_id and state = 'submitted' and version = p_expected_case_version returning * into v_case;
  if v_case.id is null then raise exception 'Owner notice case changed.' using errcode = '40001'; end if;
  insert into public.claimant_owner_protection_events (case_id, cycle_id, event_type,
    actor_class, reason_class, idempotency_key, metadata)
  values (p_case_id, v_cycle.id, 'owner_notice_requested', 'system', 'not_applicable',
    p_idempotency_key, jsonb_build_object('case_version', v_case.version,
      'cycle_number', v_cycle.cycle_number, 'cooldown_seconds', v_cycle.cooldown_seconds));
  insert into public.claimant_outbox (topic, aggregate_type, aggregate_id, dedupe_key, payload)
  values ('owner_notice_requested', 'case', p_case_id,
    'owner_notice_requested:' || p_idempotency_key::text,
    jsonb_build_object('event', 'owner_notice_requested', 'case_version', v_case.version,
      'cycle_number', v_cycle.cycle_number));
  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'cycle_id', v_cycle.id, 'cycle_number', v_cycle.cycle_number, 'state', v_case.state,
    'status', v_cycle.status, 'cooldown_active', false, 'cooldown_expires_at', null,
    'review_started', false, 'release_authorized', false, 'replayed', false);
  insert into public.claimant_owner_protection_idempotency
    (operation, case_id, idempotency_key, request_digest, result)
  values ('begin_owner_notice', p_case_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end $function$;

create function public.claimant_record_owner_notice_delivery(
  p_case_id uuid, p_cycle_id uuid, p_expected_case_version integer, p_notice_ref text,
  p_outcome text, p_delivery_evidence_digest text, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype; v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_existing public.claimant_owner_protection_idempotency%rowtype;
  v_digest text; v_result jsonb; v_event text; v_topic text;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:owner-protection:' || p_case_id::text, 0));
  if p_expected_case_version < 2 or p_notice_ref !~ '^synthetic_owner_notice_[a-z0-9_]{1,100}$'
    or p_outcome not in ('verified', 'failed', 'ambiguous')
    or (p_outcome = 'verified' and coalesce(p_delivery_evidence_digest, '') !~ '^[0-9a-f]{64}$')
    or (p_outcome <> 'verified' and p_delivery_evidence_digest is not null) then
    raise exception 'Owner notice delivery input is invalid.' using errcode = '22023';
  end if;
  v_digest := encode(extensions.digest(concat_ws('|', p_case_id::text, p_cycle_id::text,
    p_expected_case_version::text, p_notice_ref, p_outcome,
    coalesce(p_delivery_evidence_digest, '')), 'sha256'), 'hex');
  select * into v_existing from public.claimant_owner_protection_idempotency
  where operation = 'record_owner_notice_delivery' and case_id = p_case_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Idempotency key was used with different delivery input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_cycle from public.claimant_owner_protection_cycles
  where id = p_cycle_id and case_id = p_case_id for update;
  if v_case.id is null or v_case.state <> 'owner_notified' or v_case.version <> p_expected_case_version
    or v_cycle.id is null or v_cycle.status <> 'pending_delivery' or v_cycle.notice_ref <> p_notice_ref
    or v_cycle.owner_user_id <> v_case.owner_user_id or v_cycle.claimant_user_id <> v_case.claimant_user_id
    or v_cycle.policy_pack_id <> v_case.policy_pack_id
    or v_cycle.policy_pack_version <> v_case.policy_pack_version then
    raise exception 'Owner notice delivery authority changed.' using errcode = '40001';
  end if;
  if p_outcome = 'verified' then
    update public.claimant_owner_protection_cycles set status = 'delivery_verified',
      delivery_evidence_digest = p_delivery_evidence_digest, delivery_verified_at = now(),
      cooldown_started_at = now(), cooldown_expires_at = now() + make_interval(secs => cooldown_seconds),
      updated_at = now() where id = p_cycle_id returning * into v_cycle;
    update public.claimant_cases set state = 'cooldown', version = version + 1, updated_at = now()
    where id = p_case_id and state = 'owner_notified' and version = p_expected_case_version
    returning * into v_case;
    v_event := 'owner_notice_delivery_verified'; v_topic := 'owner_notice_delivery_verified';
  else
    update public.claimant_owner_protection_cycles set status = 'delivery_' || p_outcome,
      terminal_reason = 'delivery_' || p_outcome, terminal_at = now(), updated_at = now()
    where id = p_cycle_id returning * into v_cycle;
    update public.claimant_cases set state = 'on_hold', version = version + 1, updated_at = now()
    where id = p_case_id and state = 'owner_notified' and version = p_expected_case_version
    returning * into v_case;
    v_event := 'owner_notice_delivery_' || p_outcome; v_topic := 'owner_protection_held';
  end if;
  if v_case.id is null then raise exception 'Owner notice case changed.' using errcode = '40001'; end if;
  insert into public.claimant_owner_protection_events (case_id, cycle_id, event_type,
    actor_class, reason_class, idempotency_key, metadata)
  values (p_case_id, p_cycle_id, v_event, 'system',
    case when p_outcome = 'verified' then 'not_applicable' else 'delivery_' || p_outcome end,
    p_idempotency_key, jsonb_build_object('case_version', v_case.version,
      'cycle_number', v_cycle.cycle_number));
  insert into public.claimant_outbox (topic, aggregate_type, aggregate_id, dedupe_key, payload)
  values (v_topic, 'case', p_case_id, v_topic || ':' || p_idempotency_key::text,
    jsonb_build_object('event', v_event, 'case_version', v_case.version,
      'cycle_number', v_cycle.cycle_number));
  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'cycle_id', v_cycle.id, 'cycle_number', v_cycle.cycle_number, 'state', v_case.state,
    'status', v_cycle.status, 'cooldown_active', p_outcome = 'verified',
    'cooldown_expires_at', v_cycle.cooldown_expires_at, 'review_started', false,
    'release_authorized', false, 'replayed', false);
  insert into public.claimant_owner_protection_idempotency
    (operation, case_id, idempotency_key, request_digest, result)
  values ('record_owner_notice_delivery', p_case_id, p_idempotency_key,
    v_digest, v_result - 'replayed');
  return v_result;
end $function$;

create function public.claimant_stop_owner_protection(
  p_case_id uuid, p_cycle_id uuid, p_expected_case_version integer,
  p_reason text, p_actor_user_id uuid, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype; v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_existing public.claimant_owner_protection_idempotency%rowtype;
  v_digest text; v_result jsonb; v_status text; v_state text; v_event text;
  v_actor_class text; v_topic text;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:owner-protection:' || p_case_id::text, 0));
  if p_expected_case_version < 2 or p_reason not in (
    'owner_cancelled', 'claimant_dispute', 'material_change', 'conflicting_authority') then
    raise exception 'Owner protection stop input is invalid.' using errcode = '22023';
  end if;
  v_digest := encode(extensions.digest(concat_ws('|', p_case_id::text, p_cycle_id::text,
    p_expected_case_version::text, p_reason, coalesce(p_actor_user_id::text, '')), 'sha256'), 'hex');
  select * into v_existing from public.claimant_owner_protection_idempotency
  where operation = 'stop_owner_protection' and case_id = p_case_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_digest then
      raise exception 'Idempotency key was used with different stop input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_cycle from public.claimant_owner_protection_cycles
  where id = p_cycle_id and case_id = p_case_id for update;
  if v_case.id is null or v_case.state not in ('owner_notified', 'cooldown')
    or v_case.version <> p_expected_case_version or v_cycle.id is null
    or v_cycle.status not in ('pending_delivery', 'delivery_verified') then
    raise exception 'Owner protection authority changed.' using errcode = '40001';
  end if;
  if p_reason = 'owner_cancelled' then
    if p_actor_user_id is null or p_actor_user_id <> v_case.owner_user_id then
      raise exception 'Owner cancellation authority is invalid.' using errcode = '42501'; end if;
    v_status := 'cancelled'; v_state := 'cancelled_by_owner';
    v_event := 'owner_protection_cancelled'; v_actor_class := 'owner';
    v_topic := 'owner_protection_cancelled';
  elsif p_reason = 'claimant_dispute' then
    if p_actor_user_id is null or p_actor_user_id <> v_case.claimant_user_id then
      raise exception 'Claimant dispute authority is invalid.' using errcode = '42501'; end if;
    v_status := 'disputed'; v_state := 'on_hold';
    v_event := 'owner_protection_disputed'; v_actor_class := 'claimant';
    v_topic := 'owner_protection_held';
  else
    if p_actor_user_id is not null then
      raise exception 'System invalidation cannot assert a user.' using errcode = '42501'; end if;
    v_status := 'invalidated'; v_state := 'on_hold';
    v_event := 'owner_protection_invalidated'; v_actor_class := 'system';
    v_topic := 'owner_protection_held';
  end if;
  update public.claimant_owner_protection_cycles set status = v_status,
    terminal_reason = p_reason, terminal_at = now(), updated_at = now()
  where id = p_cycle_id returning * into v_cycle;
  update public.claimant_cases set state = v_state, version = version + 1, updated_at = now()
  where id = p_case_id and version = p_expected_case_version returning * into v_case;
  if v_case.id is null then raise exception 'Owner protection case changed.' using errcode = '40001'; end if;
  insert into public.claimant_owner_protection_events (case_id, cycle_id, event_type,
    actor_class, actor_user_id, reason_class, idempotency_key, metadata)
  values (p_case_id, p_cycle_id, v_event, v_actor_class, p_actor_user_id, p_reason,
    p_idempotency_key, jsonb_build_object('case_version', v_case.version,
      'cycle_number', v_cycle.cycle_number));
  insert into public.claimant_outbox (topic, aggregate_type, aggregate_id, dedupe_key, payload)
  values (v_topic, 'case', p_case_id, v_topic || ':' || p_idempotency_key::text,
    jsonb_build_object('event', v_event, 'case_version', v_case.version,
      'cycle_number', v_cycle.cycle_number, 'reason_class', p_reason));
  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'cycle_id', v_cycle.id, 'cycle_number', v_cycle.cycle_number, 'state', v_case.state,
    'status', v_cycle.status, 'cooldown_active', false, 'cooldown_expires_at', null,
    'review_started', false, 'release_authorized', false, 'replayed', false);
  insert into public.claimant_owner_protection_idempotency
    (operation, case_id, idempotency_key, request_digest, result)
  values ('stop_owner_protection', p_case_id, p_idempotency_key, v_digest, v_result - 'replayed');
  return v_result;
end $function$;

revoke all on function public.claimant_begin_owner_notice(uuid, integer, text, integer, uuid)
from public, anon, authenticated;
revoke all on function public.claimant_record_owner_notice_delivery(uuid, uuid, integer, text, text, text, uuid)
from public, anon, authenticated;
revoke all on function public.claimant_stop_owner_protection(uuid, uuid, integer, text, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.claimant_begin_owner_notice(uuid, integer, text, integer, uuid)
to service_role;
grant execute on function public.claimant_record_owner_notice_delivery(uuid, uuid, integer, text, text, text, uuid)
to service_role;
grant execute on function public.claimant_stop_owner_protection(uuid, uuid, integer, text, uuid, uuid)
to service_role;
