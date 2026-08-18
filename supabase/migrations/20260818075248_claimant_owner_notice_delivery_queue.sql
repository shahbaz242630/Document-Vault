create table public.claimant_owner_notice_deliveries (
  outbox_id uuid primary key references public.claimant_outbox(id) on delete restrict,
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  cycle_id uuid not null,
  notice_ref text not null check (notice_ref ~ '^synthetic_owner_notice_[a-z0-9_]{1,100}$'),
  delivery_idempotency_key uuid not null default gen_random_uuid() unique,
  dispatch_key text generated always as (
    'owner-notice:' || outbox_id::text || ':' || delivery_idempotency_key::text
  ) stored unique,
  attempt_number integer not null default 0 check (attempt_number >= 0),
  status text not null default 'ready' check (status in ('ready', 'leased', 'delivered', 'failed')),
  lease_token uuid null,
  lease_expires_at timestamptz null,
  outcome text null check (outcome is null or outcome in ('verified', 'failed', 'ambiguous')),
  result_case_version integer null check (result_case_version is null or result_case_version > 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  check (updated_at >= created_at),
  check (
    (status = 'ready' and attempt_number = 0 and lease_token is null
      and lease_expires_at is null and outcome is null and result_case_version is null
      and completed_at is null)
    or
    (status = 'leased' and attempt_number > 0 and lease_token is not null
      and lease_expires_at is not null and outcome is null and result_case_version is null
      and completed_at is null)
    or
    (status = 'delivered' and attempt_number > 0 and lease_token is not null
      and lease_expires_at is null and outcome = 'verified' and result_case_version is not null
      and completed_at is not null)
    or
    (status = 'failed' and attempt_number > 0 and lease_token is not null
      and lease_expires_at is null and outcome in ('failed', 'ambiguous')
      and result_case_version is not null and completed_at is not null)
  ),
  foreign key (cycle_id, case_id)
    references public.claimant_owner_protection_cycles(id, case_id) on delete restrict
);

create index claimant_owner_notice_delivery_lease_idx
on public.claimant_owner_notice_deliveries (status, lease_expires_at)
where status = 'leased';

revoke all on table public.claimant_owner_notice_deliveries from public;
revoke all on table public.claimant_owner_notice_deliveries from anon;
revoke all on table public.claimant_owner_notice_deliveries from authenticated;
grant select, insert, update on table public.claimant_owner_notice_deliveries to service_role;

alter table public.claimant_owner_notice_deliveries enable row level security;
alter table public.claimant_owner_notice_deliveries force row level security;

create policy "Claimant owner notice deliveries are server-only."
on public.claimant_owner_notice_deliveries
for all
to anon, authenticated
using (false)
with check (false);

create function public.claimant_claim_owner_notice_delivery(
  p_lease_seconds integer
) returns jsonb
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_outbox public.claimant_outbox%rowtype;
  v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_case public.claimant_cases%rowtype;
  v_delivery public.claimant_owner_notice_deliveries%rowtype;
  v_lease_token uuid;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 300 then
    raise exception 'Owner notice lease duration is invalid.' using errcode = '22023';
  end if;
  select o.* into v_outbox
  from public.claimant_outbox o
  join public.claimant_owner_protection_cycles c on c.case_id = o.aggregate_id
    and c.status = 'pending_delivery'
  join public.claimant_cases k on k.id = o.aggregate_id and k.state = 'owner_notified'
  left join public.claimant_owner_notice_deliveries d on d.outbox_id = o.id
  where o.topic = 'owner_notice_requested' and o.aggregate_type = 'case'
    and o.available_at <= now()
    and o.dedupe_key ~ '^owner_notice_requested:[0-9a-f-]{36}$'
    and ((o.status = 'pending' and d.outbox_id is null)
      or (o.status = 'processing' and d.status = 'leased' and d.lease_expires_at <= now()))
  order by o.created_at, o.id
  for update of o skip locked limit 1;
  if v_outbox.id is null then return null; end if;
  select * into strict v_cycle from public.claimant_owner_protection_cycles
  where case_id = v_outbox.aggregate_id and status = 'pending_delivery' for update;
  select * into strict v_case from public.claimant_cases
  where id = v_outbox.aggregate_id and state = 'owner_notified' for update;
  insert into public.claimant_owner_notice_deliveries
    (outbox_id, case_id, cycle_id, notice_ref)
  values (v_outbox.id, v_case.id, v_cycle.id, v_cycle.notice_ref)
  on conflict (outbox_id) do nothing;
  select * into strict v_delivery from public.claimant_owner_notice_deliveries
  where outbox_id = v_outbox.id for update;
  if v_delivery.case_id <> v_case.id or v_delivery.cycle_id <> v_cycle.id
    or v_delivery.notice_ref <> v_cycle.notice_ref
    or (v_delivery.status = 'leased' and v_delivery.lease_expires_at > now()) then
    raise exception 'Owner notice delivery authority changed.' using errcode = '40001';
  end if;
  v_lease_token := gen_random_uuid();
  update public.claimant_owner_notice_deliveries set status = 'leased',
    attempt_number = attempt_number + 1, lease_token = v_lease_token,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds), updated_at = now()
  where outbox_id = v_outbox.id returning * into strict v_delivery;
  update public.claimant_outbox set status = 'processing', attempts = v_delivery.attempt_number,
    updated_at = now() where id = v_outbox.id;
  return jsonb_build_object('aggregate_id', v_outbox.aggregate_id,
    'aggregate_type', v_outbox.aggregate_type, 'attempt_number', v_delivery.attempt_number,
    'case_id', v_case.id, 'case_version', v_case.version, 'cycle_id', v_cycle.id,
    'cycle_number', v_cycle.cycle_number, 'dedupe_key', v_outbox.dedupe_key,
    'delivery_idempotency_key', v_delivery.delivery_idempotency_key,
    'dispatch_key', v_delivery.dispatch_key, 'lease_token', v_lease_token,
    'notice_ref', v_delivery.notice_ref,
    'notice_request_id', split_part(v_outbox.dedupe_key, ':', 2)::uuid,
    'outbox_id', v_outbox.id, 'payload', v_outbox.payload, 'topic', v_outbox.topic);
end $function$;

create function public.claimant_complete_owner_notice_delivery(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_case_id uuid,
  p_cycle_id uuid,
  p_delivery_idempotency_key uuid,
  p_case_version integer,
  p_outcome text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_delivery public.claimant_owner_notice_deliveries%rowtype;
  v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_case public.claimant_cases%rowtype;
  v_status text;
begin
  if p_outcome not in ('verified', 'failed', 'ambiguous') then
    raise exception 'Owner notice completion outcome is invalid.' using errcode = '22023';
  end if;
  select * into strict v_delivery from public.claimant_owner_notice_deliveries
  where outbox_id = p_outbox_id for update;
  if v_delivery.case_id <> p_case_id or v_delivery.cycle_id <> p_cycle_id
    or v_delivery.delivery_idempotency_key <> p_delivery_idempotency_key
    or v_delivery.lease_token <> p_lease_token then
    raise exception 'Owner notice completion binding changed.' using errcode = '40001';
  end if;
  v_status := case when p_outcome = 'verified' then 'delivered' else 'failed' end;
  if v_delivery.status in ('delivered', 'failed') then
    if v_delivery.status <> v_status or v_delivery.outcome <> p_outcome
      or v_delivery.result_case_version <> p_case_version then
      raise exception 'Owner notice completion replay changed.' using errcode = '22023';
    end if;
    return jsonb_build_object('outbox_id', p_outbox_id, 'status', v_delivery.status);
  end if;
  if v_delivery.status <> 'leased' or v_delivery.lease_expires_at <= now() then
    raise exception 'Owner notice lease is no longer current.' using errcode = '40001';
  end if;
  select * into strict v_cycle from public.claimant_owner_protection_cycles
  where id = p_cycle_id and case_id = p_case_id for update;
  select * into strict v_case from public.claimant_cases where id = p_case_id for update;
  if v_case.version <> p_case_version
    or (p_outcome = 'verified' and (v_case.state <> 'cooldown'
      or v_cycle.status <> 'delivery_verified'))
    or (p_outcome <> 'verified' and (v_case.state <> 'on_hold'
      or v_cycle.status <> 'delivery_' || p_outcome)) then
    raise exception 'Owner notice result authority is invalid.' using errcode = '40001';
  end if;
  update public.claimant_owner_notice_deliveries set status = v_status,
    lease_expires_at = null, outcome = p_outcome, result_case_version = p_case_version,
    completed_at = now(), updated_at = now() where outbox_id = p_outbox_id;
  update public.claimant_outbox set status = v_status, processed_at = now(), updated_at = now()
  where id = p_outbox_id and status = 'processing';
  if not found then raise exception 'Owner notice outbox changed.' using errcode = '40001'; end if;
  return jsonb_build_object('outbox_id', p_outbox_id, 'status', v_status);
end $function$;

revoke all on function public.claimant_claim_owner_notice_delivery(integer) from public;
revoke all on function public.claimant_claim_owner_notice_delivery(integer) from anon;
revoke all on function public.claimant_claim_owner_notice_delivery(integer) from authenticated;
grant execute on function public.claimant_claim_owner_notice_delivery(integer) to service_role;
revoke all on function public.claimant_complete_owner_notice_delivery(uuid, uuid, uuid, uuid, uuid,
  integer, text) from public;
revoke all on function public.claimant_complete_owner_notice_delivery(uuid, uuid, uuid, uuid, uuid,
  integer, text) from anon;
revoke all on function public.claimant_complete_owner_notice_delivery(uuid, uuid, uuid, uuid, uuid,
  integer, text) from authenticated;
grant execute on function public.claimant_complete_owner_notice_delivery(uuid, uuid, uuid, uuid, uuid,
  integer, text) to service_role;
