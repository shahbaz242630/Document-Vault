-- Slice 7A: one accountable human approver, backed by automated pre-checks, the existing owner notice and
-- cooldown, a post-approval dispute window, a fresh re-confirmation before release and a tamper-evident audit
-- chain. The review mode is chosen per policy pack by the server; the existing two-person path is unchanged.
-- Everything stays synthetic-only and service-only.

create table public.claimant_review_policies (
  policy_pack_id text not null check (policy_pack_id ~ '^synthetic_policy_[a-z0-9_]{1,100}$'),
  policy_pack_version integer not null check (policy_pack_version > 0),
  review_mode text not null check (review_mode in ('two_person', 'single_approver')),
  min_cooldown_seconds integer not null check (min_cooldown_seconds between 86400 and 7776000),
  dispute_window_seconds integer not null check (dispute_window_seconds between 0 and 2592000),
  synthetic_only boolean not null default true check (synthetic_only),
  created_at timestamptz not null default now(),
  primary key (policy_pack_id, policy_pack_version),
  check (review_mode <> 'single_approver'
    or (min_cooldown_seconds >= 2592000 and dispute_window_seconds >= 604800))
);

alter table public.claimant_review_rounds
  add column review_mode text not null default 'two_person'
    check (review_mode in ('two_person', 'single_approver'));

do $migration$
declare v_constraint record;
begin
  for v_constraint in select conname from pg_constraint
    where conrelid = 'public.claimant_review_rounds'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%two_person_approved%' loop
    execute format('alter table public.claimant_review_rounds drop constraint %I', v_constraint.conname);
  end loop;
  for v_constraint in select conname from pg_constraint
    where conrelid = 'public.claimant_review_interventions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%two_person_approved%' loop
    execute format('alter table public.claimant_review_interventions drop constraint %I',
      v_constraint.conname);
  end loop;
  for v_constraint in select conname from pg_constraint
    where conrelid = 'public.claimant_release_authorization_idempotency'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%authorize_claimant_release%' loop
    execute format('alter table public.claimant_release_authorization_idempotency drop constraint %I',
      v_constraint.conname);
  end loop;
end $migration$;

alter table public.claimant_review_rounds
  add constraint claimant_review_rounds_status_mode_check check (
    status in ('pending', 'two_person_approved', 'single_approved', 'rejected', 'held')),
  add constraint claimant_review_rounds_outcome_mode_check check (
    (status = 'pending' and not two_person_approval_satisfied and completed_at is null)
    or (status = 'two_person_approved' and review_mode = 'two_person'
      and two_person_approval_satisfied and completed_at is not null)
    or (status = 'single_approved' and review_mode = 'single_approver'
      and not two_person_approval_satisfied and completed_at is not null)
    or (status in ('rejected', 'held') and not two_person_approval_satisfied
      and completed_at is not null));

alter table public.claimant_review_interventions
  add constraint claimant_review_interventions_source_status_mode_check check (
    source_review_status in ('pending', 'two_person_approved', 'single_approved', 'rejected', 'held'));

alter table public.claimant_release_authorizations
  add column review_mode text not null default 'two_person'
    check (review_mode in ('two_person', 'single_approver'));

alter table public.claimant_release_authorization_idempotency
  add constraint claimant_release_authorization_idempotency_operation_mode_check check (
    operation in ('authorize_claimant_release', 'authorize_single_approver_release'));

-- The server, not a request, decides a round's mode, and the mode never changes.
create function public.claimant_enforce_review_round_mode()
returns trigger language plpgsql security invoker set search_path = '' as $function$
declare v_mode text;
begin
  if tg_op = 'UPDATE' then
    if new.review_mode is distinct from old.review_mode then
      raise exception 'Review mode is immutable.' using errcode = '42501';
    end if;
    return new;
  end if;
  select review_mode into v_mode from public.claimant_review_policies
  where policy_pack_id = new.policy_pack_id and policy_pack_version = new.policy_pack_version;
  if coalesce(v_mode, 'two_person') <> new.review_mode then
    raise exception 'Review mode does not match the policy.' using errcode = '42501';
  end if;
  return new;
end $function$;

create trigger claimant_review_rounds_mode_guard
before insert or update on public.claimant_review_rounds
for each row execute function public.claimant_enforce_review_round_mode();

create table public.claimant_review_prechecks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  cycle_id uuid not null,
  review_round_id uuid null,
  phase text not null check (phase in ('decision', 'release')),
  check_set_version text not null check (check_set_version = 'single_approver_prechecks_v1'),
  case_version integer not null check (case_version > 1),
  results jsonb not null check (jsonb_typeof(results) = 'object'),
  outcome text not null check (outcome in ('clear', 'blocking')),
  synthetic_only boolean not null default true check (synthetic_only),
  recorded_at timestamptz not null default now(),
  unique (id, case_id),
  foreign key (cycle_id, case_id)
    references public.claimant_owner_protection_cycles(id, case_id) on delete restrict,
  foreign key (review_round_id, case_id)
    references public.claimant_review_rounds(id, case_id) on delete restrict
);

create table public.claimant_single_approval_windows (
  review_round_id uuid primary key,
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  cycle_id uuid not null,
  dispute_window_seconds integer not null check (dispute_window_seconds between 604800 and 2592000),
  notice_status text not null default 'pending_delivery'
    check (notice_status in ('pending_delivery', 'delivery_verified', 'delivery_failed')),
  notice_evidence_digest text null check (notice_evidence_digest ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz null,
  window_expires_at timestamptz null,
  status text not null default 'awaiting_notice'
    check (status in ('awaiting_notice', 'open', 'held', 'closed')),
  hold_actor_class text null check (hold_actor_class in ('owner', 'claimant', 'next_of_kin', 'system')),
  hold_reason_class text null check (hold_reason_class in (
    'owner_cancelled', 'claimant_dispute', 'next_of_kin_dispute', 'material_change', 'notice_failed')),
  window_version integer not null default 1 check (window_version > 0),
  synthetic_only boolean not null default true check (synthetic_only),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at),
  check ((notice_status = 'delivery_verified') = (notice_evidence_digest is not null)),
  check ((window_started_at is null) = (window_expires_at is null)),
  check (window_started_at is null or (notice_status = 'delivery_verified'
    and window_expires_at = window_started_at + make_interval(secs => dispute_window_seconds))),
  check ((status = 'held') = (hold_reason_class is not null)),
  check ((hold_actor_class is null) = (hold_reason_class is null)),
  check (status <> 'open' or window_started_at is not null),
  check (status <> 'awaiting_notice' or notice_status = 'pending_delivery'),
  unique (review_round_id, case_id),
  foreign key (review_round_id, case_id)
    references public.claimant_review_rounds(id, case_id) on delete restrict,
  foreign key (cycle_id, case_id)
    references public.claimant_owner_protection_cycles(id, case_id) on delete restrict
);

create table public.claimant_single_approval_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  review_round_id uuid null,
  precheck_id uuid null,
  event_type text not null check (event_type in (
    'review_precheck_recorded', 'single_approver_decision_recorded', 'approval_notice_verified',
    'approval_notice_failed', 'single_approval_held', 'single_approver_release_confirmed'
  )),
  outcome_class text not null check (outcome_class in (
    'clear', 'blocking', 'allow', 'reject', 'hold', 'verified', 'failed', 'owner_cancelled',
    'claimant_dispute', 'next_of_kin_dispute', 'material_change', 'release_confirmed'
  )),
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and metadata = '{}'::jsonb),
  unique (case_id, idempotency_key, event_type),
  foreign key (review_round_id, case_id)
    references public.claimant_review_rounds(id, case_id) on delete restrict,
  foreign key (precheck_id, case_id)
    references public.claimant_review_prechecks(id, case_id) on delete restrict
);

create table public.claimant_single_approval_idempotency (
  operation text not null check (operation in (
    'run_review_precheck', 'record_single_approver_decision', 'record_approval_notice',
    'hold_single_approval'
  )),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (operation, case_id, idempotency_key)
);

-- Each review, intervention, release and single-approval event is chained: an entry's hash covers the previous
-- entry's hash and the event row exactly as stored, so an edit, deletion or reordering is detectable.
create table public.claimant_review_audit_chain (
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  sequence bigint not null check (sequence > 0),
  source_table text not null check (source_table in (
    'claimant_reviewer_assignment_events', 'claimant_review_events',
    'claimant_review_intervention_events', 'claimant_release_authorization_events',
    'claimant_single_approval_events'
  )),
  source_id uuid not null,
  previous_hash text null check (previous_hash ~ '^[0-9a-f]{64}$'),
  entry_hash text not null check (entry_hash ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz not null default now(),
  primary key (case_id, sequence),
  unique (source_table, source_id),
  check ((sequence = 1) = (previous_hash is null))
);

create index claimant_review_prechecks_case_cycle_idx
on public.claimant_review_prechecks (case_id, cycle_id, phase, recorded_at desc);
create index claimant_review_prechecks_round_case_idx
on public.claimant_review_prechecks (review_round_id, case_id);
create index claimant_review_prechecks_cycle_case_idx
on public.claimant_review_prechecks (cycle_id, case_id);
create index claimant_single_approval_windows_case_idx
on public.claimant_single_approval_windows (case_id);
create index claimant_single_approval_windows_cycle_case_idx
on public.claimant_single_approval_windows (cycle_id, case_id);
create index claimant_single_approval_events_round_case_idx
on public.claimant_single_approval_events (review_round_id, case_id);
create index claimant_single_approval_events_precheck_case_idx
on public.claimant_single_approval_events (precheck_id, case_id);

create function public.claimant_append_review_audit_entry()
returns trigger language plpgsql security invoker set search_path = '' set timezone = 'UTC'
as $function$
declare v_previous public.claimant_review_audit_chain%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:review-audit:' || new.case_id::text, 0));
  select * into v_previous from public.claimant_review_audit_chain
  where case_id = new.case_id order by sequence desc limit 1;
  insert into public.claimant_review_audit_chain (case_id, sequence, source_table, source_id,
    previous_hash, entry_hash)
  values (new.case_id, coalesce(v_previous.sequence, 0) + 1, tg_table_name, new.id,
    v_previous.entry_hash, encode(extensions.digest(coalesce(v_previous.entry_hash, 'genesis') || '|'
      || tg_table_name || '|' || to_jsonb(new)::text, 'sha256'), 'hex'));
  return null;
end $function$;

create trigger claimant_reviewer_assignment_events_audit
after insert on public.claimant_reviewer_assignment_events
for each row execute function public.claimant_append_review_audit_entry();
create trigger claimant_review_events_audit
after insert on public.claimant_review_events
for each row execute function public.claimant_append_review_audit_entry();
create trigger claimant_review_intervention_events_audit
after insert on public.claimant_review_intervention_events
for each row execute function public.claimant_append_review_audit_entry();
create trigger claimant_release_authorization_events_audit
after insert on public.claimant_release_authorization_events
for each row execute function public.claimant_append_review_audit_entry();
create trigger claimant_single_approval_events_audit
after insert on public.claimant_single_approval_events
for each row execute function public.claimant_append_review_audit_entry();

revoke all on table public.claimant_review_policies from public;
revoke all on table public.claimant_review_policies from anon;
revoke all on table public.claimant_review_policies from authenticated;
revoke all on table public.claimant_review_prechecks from public;
revoke all on table public.claimant_review_prechecks from anon;
revoke all on table public.claimant_review_prechecks from authenticated;
revoke all on table public.claimant_single_approval_windows from public;
revoke all on table public.claimant_single_approval_windows from anon;
revoke all on table public.claimant_single_approval_windows from authenticated;
revoke all on table public.claimant_single_approval_events from public;
revoke all on table public.claimant_single_approval_events from anon;
revoke all on table public.claimant_single_approval_events from authenticated;
revoke all on table public.claimant_single_approval_idempotency from public;
revoke all on table public.claimant_single_approval_idempotency from anon;
revoke all on table public.claimant_single_approval_idempotency from authenticated;
revoke all on table public.claimant_review_audit_chain from public;
revoke all on table public.claimant_review_audit_chain from anon;
revoke all on table public.claimant_review_audit_chain from authenticated;
grant select, insert on table public.claimant_review_policies to service_role;
grant select, insert on table public.claimant_review_prechecks to service_role;
grant select, insert, update on table public.claimant_single_approval_windows to service_role;
grant select, insert on table public.claimant_single_approval_events to service_role;
grant select, insert on table public.claimant_single_approval_idempotency to service_role;
grant select, insert on table public.claimant_review_audit_chain to service_role;

alter table public.claimant_review_policies enable row level security;
alter table public.claimant_review_policies force row level security;
alter table public.claimant_review_prechecks enable row level security;
alter table public.claimant_review_prechecks force row level security;
alter table public.claimant_single_approval_windows enable row level security;
alter table public.claimant_single_approval_windows force row level security;
alter table public.claimant_single_approval_events enable row level security;
alter table public.claimant_single_approval_events force row level security;
alter table public.claimant_single_approval_idempotency enable row level security;
alter table public.claimant_single_approval_idempotency force row level security;
alter table public.claimant_review_audit_chain enable row level security;
alter table public.claimant_review_audit_chain force row level security;
create policy "Claimant review policies are server-only."
on public.claimant_review_policies for all to anon, authenticated using (false) with check (false);
create policy "Claimant review prechecks are server-only."
on public.claimant_review_prechecks for all to anon, authenticated using (false) with check (false);
create policy "Claimant single approval windows are server-only."
on public.claimant_single_approval_windows for all to anon, authenticated using (false) with check (false);
create policy "Claimant single approval events are server-only."
on public.claimant_single_approval_events for all to anon, authenticated using (false) with check (false);
create policy "Claimant single approval idempotency is server-only."
on public.claimant_single_approval_idempotency for all to anon, authenticated
using (false) with check (false);
create policy "Claimant review audit chain is server-only."
on public.claimant_review_audit_chain for all to anon, authenticated using (false) with check (false);

-- The Slice 4A recipient-key rule as one reusable predicate: at least two active claimant keys including the
-- current key, each with exactly one matching active owner-created grant at its current key version.
create function public.claimant_recipient_keys_current(p_case_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $function$
  select coalesce((
    select (select count(*) from public.claimant_case_device_keys case_key
        join public.claimant_device_keys device_key on device_key.id = case_key.key_id
          and device_key.claimant_user_id = case_key.claimant_user_id
        where case_key.case_id = c.id and case_key.claimant_user_id = c.claimant_user_id
          and case_key.status = 'active' and device_key.status = 'active') >= 2
      and exists (select 1 from public.claimant_case_device_keys case_key
        join public.claimant_device_keys device_key on device_key.id = case_key.key_id
        where case_key.case_id = c.id and case_key.key_id = c.current_key_id
          and case_key.claimant_user_id = c.claimant_user_id
          and case_key.status = 'active' and device_key.status = 'active')
      and not exists (select 1 from public.claimant_case_device_keys case_key
        join public.claimant_device_keys device_key on device_key.id = case_key.key_id
        where case_key.case_id = c.id and case_key.status = 'active' and device_key.status = 'active'
          and (select count(*) from public.claimant_recipient_grants grant_record
            where grant_record.case_id = c.id and grant_record.status = 'active'
              and grant_record.owner_user_id = c.owner_user_id
              and grant_record.claimant_user_id = c.claimant_user_id
              and grant_record.recipient_key_id = device_key.id
              and grant_record.recipient_key_version = device_key.key_version) <> 1)
      and not exists (select 1 from public.claimant_recipient_grants grant_record
        where grant_record.case_id = c.id and grant_record.status = 'active'
          and not exists (select 1 from public.claimant_case_device_keys case_key
            join public.claimant_device_keys device_key on device_key.id = case_key.key_id
            where case_key.case_id = c.id and case_key.key_id = grant_record.recipient_key_id
              and case_key.status = 'active' and device_key.status = 'active'
              and device_key.key_version = grant_record.recipient_key_version))
    from public.claimant_cases c where c.id = p_case_id), false);
$function$;

-- Deterministic pre-checks over data the system already holds. They can block, never approve.
create function public.claimant_run_review_precheck(
  p_case_id uuid, p_cycle_id uuid, p_phase text, p_expected_case_version integer,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_receipt public.claimant_submission_receipts%rowtype;
  v_intake public.claimant_intake_snapshots%rowtype;
  v_policy public.claimant_review_policies%rowtype;
  v_round public.claimant_review_rounds%rowtype;
  v_window public.claimant_single_approval_windows%rowtype;
  v_precheck public.claimant_review_prechecks%rowtype;
  v_existing public.claimant_single_approval_idempotency%rowtype;
  v_request_digest text; v_checklist_digest text; v_evidence_digest text;
  v_clean_count integer; v_results jsonb; v_outcome text; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:independent-review:' || p_case_id::text, 0));
  if p_phase not in ('decision', 'release') or p_expected_case_version < 2 then
    raise exception 'Review precheck input is invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_case_id::text, p_cycle_id::text,
    p_phase, p_expected_case_version::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_single_approval_idempotency
  where operation = 'run_review_precheck' and case_id = p_case_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was used with different precheck input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for share;
  select * into v_cycle from public.claimant_owner_protection_cycles
  where id = p_cycle_id and case_id = p_case_id for share;
  if v_case.id is null or v_cycle.id is null then
    raise exception 'Review precheck authority is unavailable.' using errcode = '42501';
  end if;
  select * into v_receipt from public.claimant_submission_receipts where case_id = p_case_id;
  select * into v_intake from public.claimant_intake_snapshots where case_id = p_case_id;
  select * into v_policy from public.claimant_review_policies
  where policy_pack_id = v_case.policy_pack_id and policy_pack_version = v_case.policy_pack_version;
  select * into v_round from public.claimant_review_rounds
  where case_id = p_case_id and cycle_id = p_cycle_id;
  select * into v_window from public.claimant_single_approval_windows
  where review_round_id = v_round.id;
  select encode(extensions.digest(coalesce(string_agg(
    item_key || ':' || availability, '|' order by item_key), ''), 'sha256'), 'hex')
  into v_checklist_digest from public.claimant_checklist_items where case_id = p_case_id;
  select encode(extensions.digest(coalesce(string_agg(
    object.id::text || ':' || object.version::text || ':' || object.content_digest,
    '|' order by object.id::text), ''), 'sha256'), 'hex'), count(*)
  into v_evidence_digest, v_clean_count
  from public.claimant_evidence_objects object
  join public.claimant_evidence_upload_capabilities capability
    on capability.id = object.capability_id and capability.case_id = object.case_id
  where object.case_id = p_case_id and capability.preparation_version = v_receipt.preparation_version
    and object.status = 'clean';
  v_results := jsonb_build_object(
    'policy_single_approver', coalesce(v_policy.review_mode = 'single_approver', false),
    'case_current', v_case.state = 'cooldown' and v_case.version = p_expected_case_version,
    'claimant_is_not_owner', v_case.claimant_user_id <> v_case.owner_user_id,
    'owner_notice_verified', v_cycle.status = 'delivery_verified',
    'cooldown_elapsed', coalesce(v_cycle.cooldown_expires_at <= now(), false),
    'cooldown_meets_minimum', coalesce(v_cycle.cooldown_seconds >= v_policy.min_cooldown_seconds, false),
    'submission_received', coalesce(v_receipt.status = 'received_for_review'
      and not v_receipt.review_started and not v_receipt.release_authorized
      and v_intake.version = v_receipt.intake_version
      and v_intake.status in ('ready_for_review', 'manual_review'), false),
    'checklist_complete', not exists (select 1 from public.claimant_checklist_items
      where case_id = p_case_id and availability = 'pending'),
    'evidence_complete', v_receipt.case_id is not null
      and v_clean_count = v_receipt.evidence_object_count,
    'no_other_open_claim', not exists (select 1 from public.claimant_cases other
      where other.owner_user_id = v_case.owner_user_id and other.id <> v_case.id
        and other.state not in ('released', 'closed', 'cancelled_by_owner',
          'withdrawn_by_claimant', 'rejected', 'expired')),
    'no_intervention', not exists (select 1 from public.claimant_review_interventions
      where case_id = p_case_id),
    'recipient_keys_current', public.claimant_recipient_keys_current(p_case_id));
  if p_phase = 'decision' then
    v_results := v_results || jsonb_build_object(
      'round_not_decided', v_round.id is null or v_round.status = 'pending');
  else
    v_results := v_results || jsonb_build_object(
      'round_single_approved', coalesce(v_round.status = 'single_approved'
        and v_round.review_mode = 'single_approver', false),
      'evidence_unchanged_since_decision', coalesce(v_round.checklist_digest = v_checklist_digest
        and v_round.evidence_manifest_digest = v_evidence_digest, false),
      'dispute_window_elapsed', coalesce(v_window.status = 'open'
        and v_window.notice_status = 'delivery_verified' and v_window.window_expires_at <= now(), false));
  end if;
  v_outcome := case when exists (select 1 from jsonb_each(v_results) entry
    where entry.value <> 'true'::jsonb) then 'blocking' else 'clear' end;
  insert into public.claimant_review_prechecks (case_id, cycle_id, review_round_id, phase,
    check_set_version, case_version, results, outcome)
  values (p_case_id, p_cycle_id, v_round.id, p_phase, 'single_approver_prechecks_v1',
    v_case.version, v_results, v_outcome) returning * into v_precheck;
  insert into public.claimant_single_approval_events (case_id, review_round_id, precheck_id,
    event_type, outcome_class, idempotency_key)
  values (p_case_id, v_round.id, v_precheck.id, 'review_precheck_recorded', v_outcome, p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'cycle_id', p_cycle_id, 'precheck_id', v_precheck.id, 'phase', p_phase,
    'check_set_version', 'single_approver_prechecks_v1', 'outcome', v_outcome,
    'results', v_results, 'release_authorized', false, 'replayed', false);
  insert into public.claimant_single_approval_idempotency (operation, case_id, idempotency_key,
    request_digest, result)
  values ('run_review_precheck', p_case_id, p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
end $function$;

-- One accountable human decides. An allow needs a clear decision pre-check taken at the current case version.
create function public.claimant_record_single_approver_decision(
  p_case_id uuid, p_cycle_id uuid, p_assignment_id uuid, p_reviewer_identity_id uuid,
  p_precheck_id uuid, p_expected_case_version integer, p_expected_assignment_version integer,
  p_expected_submission_case_version integer, p_expected_intake_version integer,
  p_expected_preparation_version integer, p_policy_pack_id text, p_policy_pack_version integer,
  p_checklist_digest text, p_evidence_manifest_digest text, p_decision text, p_reason_class text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_assignment public.claimant_reviewer_assignments%rowtype;
  v_reviewer public.claimant_reviewer_identities%rowtype;
  v_receipt public.claimant_submission_receipts%rowtype;
  v_intake public.claimant_intake_snapshots%rowtype;
  v_policy public.claimant_review_policies%rowtype;
  v_precheck public.claimant_review_prechecks%rowtype;
  v_round public.claimant_review_rounds%rowtype;
  v_decision public.claimant_review_decisions%rowtype;
  v_window public.claimant_single_approval_windows%rowtype;
  v_existing public.claimant_single_approval_idempotency%rowtype;
  v_request_digest text; v_checklist_digest text; v_evidence_digest text; v_status text;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:independent-review:' || p_case_id::text, 0));
  if p_expected_case_version < 2 or p_expected_assignment_version < 1
    or p_expected_submission_case_version < 2 or p_expected_intake_version < 2
    or p_expected_preparation_version < 2 or p_policy_pack_version < 1
    or p_policy_pack_id !~ '^synthetic_policy_[a-z0-9_]{1,100}$'
    or p_checklist_digest !~ '^[0-9a-f]{64}$'
    or p_evidence_manifest_digest !~ '^[0-9a-f]{64}$'
    or p_decision not in ('allow', 'reject', 'hold')
    or (p_decision = 'allow' and p_reason_class <> 'requirements_satisfied')
    or (p_decision = 'reject' and p_reason_class not in (
      'authority_not_established', 'identity_not_established',
      'relationship_not_established', 'evidence_inconsistent'))
    or (p_decision = 'hold' and p_reason_class not in (
      'more_information_needed', 'conflict_or_dispute', 'policy_review_required')) then
    raise exception 'Single approver decision input is invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_cycle_id::text, p_assignment_id::text, p_reviewer_identity_id::text, p_precheck_id::text,
    p_expected_case_version::text, p_expected_assignment_version::text,
    p_expected_submission_case_version::text, p_expected_intake_version::text,
    p_expected_preparation_version::text, p_policy_pack_id, p_policy_pack_version::text,
    p_checklist_digest, p_evidence_manifest_digest, p_decision, p_reason_class), 'sha256'), 'hex');
  select * into v_existing from public.claimant_single_approval_idempotency
  where operation = 'record_single_approver_decision' and case_id = p_case_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was used with different decision input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_cycle from public.claimant_owner_protection_cycles
  where id = p_cycle_id and case_id = p_case_id for update;
  select * into v_assignment from public.claimant_reviewer_assignments
  where id = p_assignment_id and case_id = p_case_id for update;
  select * into v_reviewer from public.claimant_reviewer_identities
  where id = p_reviewer_identity_id for update;
  select * into v_receipt from public.claimant_submission_receipts where case_id = p_case_id;
  select * into v_intake from public.claimant_intake_snapshots where case_id = p_case_id;
  select * into v_policy from public.claimant_review_policies
  where policy_pack_id = p_policy_pack_id and policy_pack_version = p_policy_pack_version;
  select * into v_precheck from public.claimant_review_prechecks
  where id = p_precheck_id and case_id = p_case_id;
  if v_case.id is null or v_case.state <> 'cooldown' or v_case.version <> p_expected_case_version
    or v_case.policy_pack_id <> p_policy_pack_id
    or v_case.policy_pack_version <> p_policy_pack_version
    or v_policy.review_mode is distinct from 'single_approver'
    or v_cycle.id is null or v_cycle.status <> 'delivery_verified'
    or v_cycle.cooldown_expires_at is null or v_cycle.cooldown_expires_at > now()
    or v_cycle.cooldown_seconds < v_policy.min_cooldown_seconds
    or v_assignment.id is null or v_assignment.cycle_id <> p_cycle_id
    or v_assignment.status <> 'assigned' or v_assignment.assignment_slot <> 1
    or v_assignment.reviewer_identity_id <> p_reviewer_identity_id
    or v_assignment.assignment_version <> p_expected_assignment_version
    or v_reviewer.id is null or v_reviewer.status <> 'active' or not v_reviewer.synthetic_only
    or v_reviewer.live_review_authority or v_reviewer.reviewer_class <> 'accountable_human_test'
    or v_reviewer.user_id in (v_case.owner_user_id, v_case.claimant_user_id)
    or v_receipt.case_id is null or v_receipt.case_version <> p_expected_submission_case_version
    or v_receipt.intake_version <> p_expected_intake_version
    or v_receipt.preparation_version <> p_expected_preparation_version
    or v_receipt.review_started or v_receipt.release_authorized
    or v_intake.case_id is null or v_intake.version <> p_expected_intake_version
    or v_intake.policy_pack_id <> p_policy_pack_id
    or v_intake.policy_pack_version <> p_policy_pack_version
    or v_intake.status not in ('ready_for_review', 'manual_review') then
    raise exception 'Single approver authority changed.' using errcode = '40001';
  end if;
  if v_precheck.id is null or v_precheck.cycle_id <> p_cycle_id or v_precheck.phase <> 'decision'
    or v_precheck.case_version <> p_expected_case_version
    or v_precheck.recorded_at < now() - interval '24 hours'
    or (p_decision = 'allow' and v_precheck.outcome <> 'clear') then
    raise exception 'Single approver precheck is missing, stale or blocking.' using errcode = '40001';
  end if;
  select encode(extensions.digest(coalesce(string_agg(
    item_key || ':' || availability, '|' order by item_key), ''), 'sha256'), 'hex')
  into v_checklist_digest from public.claimant_checklist_items where case_id = p_case_id;
  select encode(extensions.digest(coalesce(string_agg(
    object.id::text || ':' || object.version::text || ':' || object.content_digest,
    '|' order by object.id::text), ''), 'sha256'), 'hex')
  into v_evidence_digest
  from public.claimant_evidence_objects object
  join public.claimant_evidence_upload_capabilities capability
    on capability.id = object.capability_id and capability.case_id = object.case_id
  where object.case_id = p_case_id and capability.preparation_version = p_expected_preparation_version
    and object.status = 'clean';
  if v_checklist_digest <> p_checklist_digest or v_evidence_digest <> p_evidence_manifest_digest
    or exists (select 1 from public.claimant_checklist_items
      where case_id = p_case_id and availability = 'pending') then
    raise exception 'Single approver evidence authority changed.' using errcode = '40001';
  end if;
  select * into v_round from public.claimant_review_rounds
  where case_id = p_case_id and cycle_id = p_cycle_id for update;
  if v_round.id is not null then
    raise exception 'Single approver round already decided.' using errcode = '40001';
  end if;
  insert into public.claimant_review_rounds (case_id, cycle_id, case_version,
    submission_case_version, intake_version, preparation_version, policy_pack_id,
    policy_pack_version, checklist_digest, evidence_manifest_digest, review_mode)
  values (p_case_id, p_cycle_id, p_expected_case_version, p_expected_submission_case_version,
    p_expected_intake_version, p_expected_preparation_version, p_policy_pack_id,
    p_policy_pack_version, p_checklist_digest, p_evidence_manifest_digest, 'single_approver')
  returning * into v_round;
  insert into public.claimant_review_decisions (review_round_id, case_id, assignment_id,
    reviewer_identity_id, assignment_slot, assignment_version, decision, reason_class,
    case_version, intake_version, preparation_version, policy_pack_id, policy_pack_version,
    checklist_digest, evidence_manifest_digest)
  values (v_round.id, p_case_id, p_assignment_id, p_reviewer_identity_id, 1,
    v_assignment.assignment_version, p_decision, p_reason_class, p_expected_case_version,
    p_expected_intake_version, p_expected_preparation_version, p_policy_pack_id,
    p_policy_pack_version, p_checklist_digest, p_evidence_manifest_digest)
  returning * into v_decision;
  insert into public.claimant_review_events (review_round_id, case_id, decision_id,
    event_type, reviewer_identity_id, reason_class, idempotency_key)
  values (v_round.id, p_case_id, v_decision.id, 'independent_review_recorded',
    p_reviewer_identity_id, p_reason_class, p_idempotency_key);
  v_status := case p_decision when 'allow' then 'single_approved'
    when 'reject' then 'rejected' else 'held' end;
  update public.claimant_review_rounds set status = v_status, round_version = round_version + 1,
    completed_at = now(), updated_at = now()
  where id = v_round.id and status = 'pending' returning * into v_round;
  if v_status = 'single_approved' then
    insert into public.claimant_single_approval_windows (review_round_id, case_id, cycle_id,
      dispute_window_seconds)
    values (v_round.id, p_case_id, p_cycle_id, v_policy.dispute_window_seconds)
    returning * into v_window;
  end if;
  insert into public.claimant_single_approval_events (case_id, review_round_id, precheck_id,
    event_type, outcome_class, idempotency_key)
  values (p_case_id, v_round.id, p_precheck_id, 'single_approver_decision_recorded', p_decision,
    p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'cycle_id', p_cycle_id, 'review_round_id', v_round.id, 'round_version', v_round.round_version,
    'review_mode', 'single_approver', 'review_status', v_round.status,
    'dispute_window_status', v_window.status, 'release_authorized', false, 'replayed', false);
  insert into public.claimant_single_approval_idempotency (operation, case_id, idempotency_key,
    request_digest, result)
  values ('record_single_approver_decision', p_case_id, p_idempotency_key, v_request_digest,
    v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Single approver decision conflicts with existing authority.' using errcode = '40001';
end $function$;

-- The owner is told the claim was approved; the dispute window starts only from verified delivery.
create function public.claimant_record_approval_notice_delivery(
  p_case_id uuid, p_review_round_id uuid, p_expected_window_version integer, p_outcome text,
  p_evidence_digest text, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_window public.claimant_single_approval_windows%rowtype;
  v_existing public.claimant_single_approval_idempotency%rowtype;
  v_request_digest text; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:independent-review:' || p_case_id::text, 0));
  if p_expected_window_version < 1 or p_outcome not in ('verified', 'failed')
    or (p_outcome = 'verified' and coalesce(p_evidence_digest, '') !~ '^[0-9a-f]{64}$')
    or (p_outcome = 'failed' and p_evidence_digest is not null) then
    raise exception 'Approval notice input is invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_review_round_id::text, p_expected_window_version::text, p_outcome,
    coalesce(p_evidence_digest, '')), 'sha256'), 'hex');
  select * into v_existing from public.claimant_single_approval_idempotency
  where operation = 'record_approval_notice' and case_id = p_case_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was used with different notice input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_window from public.claimant_single_approval_windows
  where review_round_id = p_review_round_id and case_id = p_case_id for update;
  if v_window.review_round_id is null or v_window.status <> 'awaiting_notice'
    or v_window.window_version <> p_expected_window_version then
    raise exception 'Approval notice authority changed.' using errcode = '40001';
  end if;
  if p_outcome = 'verified' then
    update public.claimant_single_approval_windows set notice_status = 'delivery_verified',
      notice_evidence_digest = p_evidence_digest, window_started_at = now(),
      window_expires_at = now() + make_interval(secs => dispute_window_seconds), status = 'open',
      window_version = window_version + 1, updated_at = now()
    where review_round_id = p_review_round_id returning * into v_window;
  else
    update public.claimant_single_approval_windows set notice_status = 'delivery_failed',
      status = 'held', hold_actor_class = 'system', hold_reason_class = 'notice_failed',
      window_version = window_version + 1, updated_at = now()
    where review_round_id = p_review_round_id returning * into v_window;
  end if;
  insert into public.claimant_single_approval_events (case_id, review_round_id, event_type,
    outcome_class, idempotency_key)
  values (p_case_id, p_review_round_id,
    case p_outcome when 'verified' then 'approval_notice_verified' else 'approval_notice_failed' end,
    p_outcome, p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id, 'review_round_id', p_review_round_id,
    'window_version', v_window.window_version, 'dispute_window_status', v_window.status,
    'dispute_window_expires_at', v_window.window_expires_at, 'release_authorized', false,
    'replayed', false);
  insert into public.claimant_single_approval_idempotency (operation, case_id, idempotency_key,
    request_digest, result)
  values ('record_approval_notice', p_case_id, p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
end $function$;

-- During the window the owner, the claimant, another registered next of kin, or a material change puts the
-- approval on hold. A held approval can never be released; the only way forward is a new claim cycle.
create function public.claimant_hold_single_approval(
  p_case_id uuid, p_review_round_id uuid, p_expected_window_version integer, p_actor_class text,
  p_actor_user_id uuid, p_reason_class text, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_window public.claimant_single_approval_windows%rowtype;
  v_existing public.claimant_single_approval_idempotency%rowtype;
  v_request_digest text; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('claimant:independent-review:' || p_case_id::text, 0));
  if p_expected_window_version < 1
    or (p_actor_class, p_reason_class) not in (('owner', 'owner_cancelled'),
      ('claimant', 'claimant_dispute'), ('next_of_kin', 'next_of_kin_dispute'),
      ('system', 'material_change'))
    or ((p_actor_class = 'system') <> (p_actor_user_id is null)) then
    raise exception 'Approval hold input is invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_review_round_id::text, p_expected_window_version::text, p_actor_class,
    coalesce(p_actor_user_id::text, ''), p_reason_class), 'sha256'), 'hex');
  select * into v_existing from public.claimant_single_approval_idempotency
  where operation = 'hold_single_approval' and case_id = p_case_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was used with different hold input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for share;
  select * into v_window from public.claimant_single_approval_windows
  where review_round_id = p_review_round_id and case_id = p_case_id for update;
  if v_case.id is null or v_window.review_round_id is null
    or v_window.status not in ('awaiting_notice', 'open')
    or v_window.window_version <> p_expected_window_version
    or (p_actor_class = 'owner' and p_actor_user_id <> v_case.owner_user_id)
    or (p_actor_class = 'claimant' and p_actor_user_id <> v_case.claimant_user_id)
    or (p_actor_class = 'next_of_kin' and (p_actor_user_id in (v_case.owner_user_id, v_case.claimant_user_id)
      or not exists (select 1 from public.claimant_invitations invitation
        where invitation.owner_user_id = v_case.owner_user_id and invitation.status = 'accepted'
          and invitation.accepted_by_user_id = p_actor_user_id))) then
    raise exception 'Approval hold authority is unavailable.' using errcode = '42501';
  end if;
  update public.claimant_single_approval_windows set status = 'held', hold_actor_class = p_actor_class,
    hold_reason_class = p_reason_class, window_version = window_version + 1, updated_at = now()
  where review_round_id = p_review_round_id returning * into v_window;
  insert into public.claimant_single_approval_events (case_id, review_round_id, event_type,
    outcome_class, idempotency_key)
  values (p_case_id, p_review_round_id, 'single_approval_held', p_reason_class, p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id, 'review_round_id', p_review_round_id,
    'window_version', v_window.window_version, 'dispute_window_status', 'held',
    'release_authorized', false, 'replayed', false);
  insert into public.claimant_single_approval_idempotency (operation, case_id, idempotency_key,
    request_digest, result)
  values ('hold_single_approval', p_case_id, p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
end $function$;

-- Release for a single-approver round: every Slice 4A prerequisite, plus an elapsed and undisturbed dispute
-- window, a clear release pre-check taken after it, and the same accountable human re-confirming with fresh MFA.
create function public.claimant_authorize_single_approver_release(
  p_case_id uuid, p_cycle_id uuid, p_review_round_id uuid, p_authority_identity_id uuid,
  p_release_precheck_id uuid, p_expected_case_version integer, p_expected_round_version integer,
  p_expected_binding_version integer, p_expected_finalization_version integer,
  p_expected_window_version integer, p_fresh_assurance_at timestamptz, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_round public.claimant_review_rounds%rowtype;
  v_receipt public.claimant_submission_receipts%rowtype;
  v_window public.claimant_single_approval_windows%rowtype;
  v_precheck public.claimant_review_prechecks%rowtype;
  v_decision public.claimant_review_decisions%rowtype;
  v_reviewer public.claimant_reviewer_identities%rowtype;
  v_assignment public.claimant_reviewer_assignments%rowtype;
  v_authority public.claimant_release_authority_identities%rowtype;
  v_authorization public.claimant_release_authorizations%rowtype;
  v_existing public.claimant_release_authorization_idempotency%rowtype;
  v_request_digest text; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:release-authorization:' || p_case_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('claimant:independent-review:' || p_case_id::text, 0));
  if p_expected_case_version < 2 or p_expected_round_version < 2
    or p_expected_binding_version < 1 or p_expected_finalization_version < 1
    or p_expected_window_version < 1 or p_fresh_assurance_at is null then
    raise exception 'Single approver release input is invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_cycle_id::text, p_review_round_id::text, p_authority_identity_id::text,
    p_release_precheck_id::text, p_expected_case_version::text, p_expected_round_version::text,
    p_expected_binding_version::text, p_expected_finalization_version::text,
    p_expected_window_version::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_release_authorization_idempotency
  where operation = 'authorize_single_approver_release' and case_id = p_case_id
    and authority_identity_id = p_authority_identity_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was used with different release input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  if p_fresh_assurance_at < now() - interval '600 seconds'
    or p_fresh_assurance_at > now() + interval '60 seconds' then
    raise exception 'Single approver re-confirmation is not fresh.' using errcode = '42501';
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_cycle from public.claimant_owner_protection_cycles
  where id = p_cycle_id and case_id = p_case_id for update;
  select * into v_round from public.claimant_review_rounds
  where id = p_review_round_id and case_id = p_case_id for update;
  select * into v_window from public.claimant_single_approval_windows
  where review_round_id = p_review_round_id and case_id = p_case_id for update;
  select * into v_precheck from public.claimant_review_prechecks
  where id = p_release_precheck_id and case_id = p_case_id;
  select * into v_receipt from public.claimant_submission_receipts where case_id = p_case_id;
  select * into v_authority from public.claimant_release_authority_identities
  where id = p_authority_identity_id for update;
  if (select count(*) from public.claimant_review_decisions
      where review_round_id = p_review_round_id) <> 1 then
    raise exception 'Single approver release review authority changed.' using errcode = '40001';
  end if;
  select * into v_decision from public.claimant_review_decisions
  where review_round_id = p_review_round_id;
  select * into v_assignment from public.claimant_reviewer_assignments
  where id = v_decision.assignment_id and case_id = p_case_id for update;
  select * into v_reviewer from public.claimant_reviewer_identities
  where id = v_decision.reviewer_identity_id for update;
  if v_case.id is null or v_case.state <> 'cooldown'
    or v_case.version <> p_expected_case_version
    or v_case.binding_version <> p_expected_binding_version
    or v_case.finalization_version <> p_expected_finalization_version
    or v_case.owner_finalized_at is null
    or v_cycle.id is null or v_cycle.status <> 'delivery_verified'
    or v_cycle.cooldown_expires_at is null or v_cycle.cooldown_expires_at > now()
    or v_cycle.owner_user_id <> v_case.owner_user_id
    or v_cycle.claimant_user_id <> v_case.claimant_user_id
    or v_cycle.policy_pack_id <> v_case.policy_pack_id
    or v_cycle.policy_pack_version <> v_case.policy_pack_version
    or v_round.id is null or v_round.cycle_id <> p_cycle_id
    or v_round.review_mode <> 'single_approver' or v_round.status <> 'single_approved'
    or v_round.case_version <> p_expected_case_version
    or v_round.round_version <> p_expected_round_version or v_round.release_authorized
    or v_round.policy_pack_id <> v_case.policy_pack_id
    or v_round.policy_pack_version <> v_case.policy_pack_version
    or v_receipt.case_id is null or v_receipt.case_version <> v_round.submission_case_version
    or v_receipt.status <> 'received_for_review'
    or v_receipt.review_started or v_receipt.release_authorized
    or v_window.review_round_id is null or v_window.status <> 'open'
    or v_window.notice_status <> 'delivery_verified'
    or v_window.window_version <> p_expected_window_version
    or v_window.window_expires_at > now()
    or v_precheck.id is null or v_precheck.phase <> 'release' or v_precheck.outcome <> 'clear'
    or v_precheck.cycle_id <> p_cycle_id or v_precheck.review_round_id <> p_review_round_id
    or v_precheck.case_version <> p_expected_case_version
    or v_precheck.recorded_at < v_window.window_expires_at
    or v_precheck.recorded_at < now() - interval '1 hour'
    or v_decision.decision <> 'allow' or v_decision.assignment_slot <> 1
    or v_assignment.id is null or v_assignment.cycle_id <> p_cycle_id
    or v_assignment.status <> 'assigned'
    or v_assignment.assignment_version <> v_decision.assignment_version
    or v_assignment.reviewer_identity_id <> v_decision.reviewer_identity_id
    or v_reviewer.id is null or v_reviewer.status <> 'active' or not v_reviewer.synthetic_only
    or v_reviewer.live_review_authority or v_reviewer.reviewer_class <> 'accountable_human_test'
    or v_authority.id is null or v_authority.status <> 'active'
    or v_authority.authority_class <> 'release_test_authorizer'
    or not v_authority.synthetic_only or v_authority.live_release_authority
    or v_authority.user_id <> v_reviewer.user_id
    or v_authority.user_id in (v_case.owner_user_id, v_case.claimant_user_id)
    or exists (select 1 from public.claimant_review_resolution_authorities resolution
      where resolution.user_id = v_authority.user_id)
    or exists (select 1 from public.claimant_review_interventions intervention
      where intervention.case_id = p_case_id) then
    raise exception 'Single approver release authority changed.' using errcode = '42501';
  end if;
  if not public.claimant_recipient_keys_current(p_case_id) then
    raise exception 'Release recipient authority changed.' using errcode = '40001';
  end if;
  insert into public.claimant_release_authorizations (case_id, cycle_id, review_round_id,
    authority_identity_id, source_case_version, authorized_case_version, binding_version,
    finalization_version, submission_case_version, review_round_version,
    policy_pack_id, policy_pack_version, review_mode)
  values (p_case_id, p_cycle_id, p_review_round_id, p_authority_identity_id,
    p_expected_case_version, p_expected_case_version + 1, p_expected_binding_version,
    p_expected_finalization_version, v_round.submission_case_version,
    p_expected_round_version, v_case.policy_pack_id, v_case.policy_pack_version, 'single_approver')
  returning * into v_authorization;
  update public.claimant_cases set state = 'approved', version = version + 1, updated_at = now()
  where id = p_case_id and state = 'cooldown' and version = p_expected_case_version
    and binding_version = p_expected_binding_version
    and finalization_version = p_expected_finalization_version
  returning * into v_case;
  if v_case.id is null then
    raise exception 'Release case changed during authorization.' using errcode = '40001';
  end if;
  update public.claimant_single_approval_windows set status = 'closed',
    window_version = window_version + 1, updated_at = now()
  where review_round_id = p_review_round_id;
  insert into public.claimant_release_authorization_events (authorization_id, case_id,
    authority_identity_id, event_type, reason_class, idempotency_key)
  values (v_authorization.id, p_case_id, p_authority_identity_id,
    'release_authorized', 'all_release_prerequisites_revalidated', p_idempotency_key);
  insert into public.claimant_single_approval_events (case_id, review_round_id, precheck_id,
    event_type, outcome_class, idempotency_key)
  values (p_case_id, p_review_round_id, p_release_precheck_id, 'single_approver_release_confirmed',
    'release_confirmed', p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'case_state', v_case.state, 'cycle_id', p_cycle_id,
    'review_round_id', p_review_round_id, 'release_authorization_id', v_authorization.id,
    'release_status', v_authorization.status, 'review_mode', 'single_approver',
    'release_authorized', true, 'package_creation_authorized', false,
    'retrieval_authorized', false, 'replayed', false);
  insert into public.claimant_release_authorization_idempotency (operation, case_id,
    authority_identity_id, idempotency_key, request_digest, result)
  values ('authorize_single_approver_release', p_case_id, p_authority_identity_id,
    p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Single approver release conflicts with existing authority.' using errcode = '40001';
end $function$;

-- Recomputes every chained entry from the stored event rows. Any edit, deletion, reordering, missing link or
-- unchained event makes the case's chain unverified.
create function public.claimant_verify_review_audit_chain(p_case_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' set timezone = 'UTC'
as $function$
declare
  v_entry public.claimant_review_audit_chain%rowtype;
  v_previous text := null; v_expected_sequence bigint := 1; v_row text; v_count bigint := 0;
  v_source_count bigint;
begin
  for v_entry in select * from public.claimant_review_audit_chain
    where case_id = p_case_id order by sequence loop
    execute format('select to_jsonb(t)::text from public.%I t where t.id = $1 and t.case_id = $2',
      v_entry.source_table) into v_row using v_entry.source_id, p_case_id;
    if v_entry.sequence <> v_expected_sequence or v_row is null
      or v_entry.previous_hash is distinct from v_previous
      or v_entry.entry_hash <> encode(extensions.digest(coalesce(v_previous, 'genesis') || '|'
        || v_entry.source_table || '|' || v_row, 'sha256'), 'hex') then
      return jsonb_build_object('case_id', p_case_id, 'verified', false, 'entries', v_count);
    end if;
    v_previous := v_entry.entry_hash; v_expected_sequence := v_expected_sequence + 1;
    v_count := v_count + 1;
  end loop;
  select (select count(*) from public.claimant_reviewer_assignment_events where case_id = p_case_id)
    + (select count(*) from public.claimant_review_events where case_id = p_case_id)
    + (select count(*) from public.claimant_review_intervention_events where case_id = p_case_id)
    + (select count(*) from public.claimant_release_authorization_events where case_id = p_case_id)
    + (select count(*) from public.claimant_single_approval_events where case_id = p_case_id)
  into v_source_count;
  return jsonb_build_object('case_id', p_case_id, 'verified', v_source_count = v_count,
    'entries', v_count);
end $function$;

-- A value-free audit export: when each step happened, what kind of step it was and its chain hash.
create function public.claimant_export_review_audit(p_case_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' set timezone = 'UTC'
as $function$
declare v_entry public.claimant_review_audit_chain%rowtype; v_event text; v_at timestamptz;
  v_entries jsonb := '[]'::jsonb;
begin
  for v_entry in select * from public.claimant_review_audit_chain
    where case_id = p_case_id order by sequence loop
    execute format('select t.event_type, t.occurred_at from public.%I t where t.id = $1',
      v_entry.source_table) into v_event, v_at using v_entry.source_id;
    v_entries := v_entries || jsonb_build_array(jsonb_build_object('sequence', v_entry.sequence,
      'step', case v_entry.source_table
        when 'claimant_reviewer_assignment_events' then 'reviewer_assignment'
        when 'claimant_review_events' then 'review'
        when 'claimant_review_intervention_events' then 'intervention'
        when 'claimant_release_authorization_events' then 'release'
        else 'single_approval' end,
      'event_type', v_event, 'occurred_at', v_at, 'entry_hash', v_entry.entry_hash));
  end loop;
  return jsonb_build_object('case_id', p_case_id,
    'verified', (public.claimant_verify_review_audit_chain(p_case_id) ->> 'verified')::boolean,
    'entries', v_entries);
end $function$;

revoke all on function public.claimant_enforce_review_round_mode() from public, anon, authenticated;
revoke all on function public.claimant_append_review_audit_entry() from public, anon, authenticated;
revoke all on function public.claimant_recipient_keys_current(uuid) from public, anon, authenticated;
revoke all on function public.claimant_run_review_precheck(uuid, uuid, text, integer, uuid)
from public, anon, authenticated;
revoke all on function public.claimant_record_single_approver_decision(
  uuid, uuid, uuid, uuid, uuid, integer, integer, integer, integer, integer, text, integer, text, text,
  text, text, uuid) from public, anon, authenticated;
revoke all on function public.claimant_record_approval_notice_delivery(uuid, uuid, integer, text, text, uuid)
from public, anon, authenticated;
revoke all on function public.claimant_hold_single_approval(uuid, uuid, integer, text, uuid, text, uuid)
from public, anon, authenticated;
revoke all on function public.claimant_authorize_single_approver_release(
  uuid, uuid, uuid, uuid, uuid, integer, integer, integer, integer, integer, timestamptz, uuid)
from public, anon, authenticated;
revoke all on function public.claimant_verify_review_audit_chain(uuid) from public, anon, authenticated;
revoke all on function public.claimant_export_review_audit(uuid) from public, anon, authenticated;
grant execute on function public.claimant_recipient_keys_current(uuid) to service_role;
grant execute on function public.claimant_run_review_precheck(uuid, uuid, text, integer, uuid)
to service_role;
grant execute on function public.claimant_record_single_approver_decision(
  uuid, uuid, uuid, uuid, uuid, integer, integer, integer, integer, integer, text, integer, text, text,
  text, text, uuid) to service_role;
grant execute on function public.claimant_record_approval_notice_delivery(uuid, uuid, integer, text, text, uuid)
to service_role;
grant execute on function public.claimant_hold_single_approval(uuid, uuid, integer, text, uuid, text, uuid)
to service_role;
grant execute on function public.claimant_authorize_single_approver_release(
  uuid, uuid, uuid, uuid, uuid, integer, integer, integer, integer, integer, timestamptz, uuid)
to service_role;
grant execute on function public.claimant_verify_review_audit_chain(uuid) to service_role;
grant execute on function public.claimant_export_review_audit(uuid) to service_role;

-- Slices 4B and 4C accept a single-approver approval only when the release authorization was itself made on
-- the single-approver path, and a two-person approval only on the two-person path. These are the original
-- functions with exactly that one condition changed; scripts/claimant-single-approver-review-migration.test.cjs
-- checks that nothing else differs.

create or replace function public.claimant_prepare_encrypted_release_package(
  p_owner_user_id uuid, p_case_id uuid, p_release_authorization_id uuid,
  p_cycle_id uuid, p_review_round_id uuid, p_expected_case_version integer,
  p_package_id uuid, p_package_ref text, p_assets jsonb, p_grants jsonb,
  p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_authorization public.claimant_release_authorizations%rowtype;
  v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_round public.claimant_review_rounds%rowtype;
  v_authority public.claimant_release_authority_identities%rowtype;
  v_asset public.vault_assets%rowtype;
  v_grant public.claimant_recipient_grants%rowtype;
  v_existing public.claimant_release_package_idempotency%rowtype;
  v_package public.claimant_release_packages%rowtype;
  v_entry record; v_request_digest text; v_asset_digest text; v_grant_digest text;
  v_asset_manifest text := ''; v_grant_manifest text := ''; v_manifest_digest text;
  v_asset_ids uuid[] := array[]::uuid[]; v_grant_ids uuid[] := array[]::uuid[];
  v_asset_count integer; v_grant_count integer; v_active_grant_count integer;
  v_total_ciphertext_length bigint := 0; v_snapshot_boundary timestamptz;
  v_prepared_at timestamptz := now(); v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:encrypted-release-package:' || p_case_id::text, 0));
  if p_expected_case_version < 3
    or p_package_ref !~ '^synthetic_release_package_[a-z0-9_]{1,100}$'
    or jsonb_typeof(p_assets) <> 'array' or jsonb_typeof(p_grants) <> 'array' then
    raise exception 'Encrypted package input is invalid.' using errcode = '22023';
  end if;
  v_asset_count := jsonb_array_length(p_assets);
  v_grant_count := jsonb_array_length(p_grants);
  if v_asset_count not between 1 and 100 or v_grant_count not between 2 and 10 then
    raise exception 'Encrypted package bounds are invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_owner_user_id::text,
    p_case_id::text, p_release_authorization_id::text, p_cycle_id::text,
    p_review_round_id::text, p_expected_case_version::text, p_package_id::text,
    p_package_ref, p_assets::text, p_grants::text), 'sha256'), 'hex');
  select * into v_existing from public.claimant_release_package_idempotency
  where operation = 'prepare_encrypted_release_package' and case_id = p_case_id
    and owner_user_id = p_owner_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was used with different package input.'
        using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_cycle from public.claimant_owner_protection_cycles
  where id = p_cycle_id and case_id = p_case_id for update;
  select * into v_round from public.claimant_review_rounds
  where id = p_review_round_id and case_id = p_case_id for update;
  select * into v_authorization from public.claimant_release_authorizations
  -- Authorization records are append-only; mutable authority is locked above/below.
  where id = p_release_authorization_id and case_id = p_case_id;
  select * into v_authority from public.claimant_release_authority_identities
  where id = v_authorization.authority_identity_id for update;
  if v_case.id is null or v_case.owner_user_id <> p_owner_user_id
    or v_case.state <> 'approved' or v_case.version <> p_expected_case_version
    or v_case.route_profile <> 'registered_recipient_v1'
    or v_authorization.id is null
    or v_authorization.authorized_case_version <> p_expected_case_version
    or v_authorization.cycle_id <> p_cycle_id
    or v_authorization.review_round_id <> p_review_round_id
    or v_authorization.status <> 'authorized' or not v_authorization.release_authorized
    or v_authorization.package_creation_authorized or v_authorization.retrieval_authorized
    or v_authorization.policy_pack_id <> v_case.policy_pack_id
    or v_authorization.policy_pack_version <> v_case.policy_pack_version
    or v_cycle.id is null or v_cycle.status <> 'delivery_verified'
    or v_cycle.cooldown_expires_at is null or v_cycle.cooldown_expires_at > v_prepared_at
    or v_cycle.owner_user_id <> v_case.owner_user_id
    or v_cycle.claimant_user_id <> v_case.claimant_user_id
    or v_round.id is null or not ((v_round.status = 'two_person_approved'
        and v_round.two_person_approval_satisfied and v_round.review_mode = 'two_person'
        and v_authorization.review_mode = 'two_person')
      or (v_round.status = 'single_approved' and v_round.review_mode = 'single_approver'
        and not v_round.two_person_approval_satisfied
        and v_authorization.review_mode = 'single_approver'))
    or v_round.release_authorized
    or v_round.round_version <> v_authorization.review_round_version
    or v_authority.id is null or v_authority.status <> 'active'
    or not v_authority.synthetic_only or v_authority.live_release_authority
    or exists (select 1 from public.claimant_review_interventions intervention
      where intervention.case_id = p_case_id) then
    raise exception 'Encrypted package authority changed.' using errcode = '42501';
  end if;
  select count(*) into v_active_grant_count
  from public.claimant_recipient_grants grant_record
  join public.claimant_case_device_keys case_key
    on case_key.case_id = grant_record.case_id
      and case_key.key_id = grant_record.recipient_key_id
      and case_key.claimant_user_id = grant_record.claimant_user_id
  join public.claimant_device_keys device_key
    on device_key.id = case_key.key_id
      and device_key.claimant_user_id = case_key.claimant_user_id
  where grant_record.case_id = p_case_id and grant_record.status = 'active'
    and grant_record.owner_user_id = p_owner_user_id
    and grant_record.claimant_user_id = v_case.claimant_user_id
    and case_key.status = 'active' and device_key.status = 'active'
    and grant_record.recipient_key_version = device_key.key_version;
  if v_active_grant_count <> v_grant_count then
    raise exception 'Encrypted package grant set changed.' using errcode = '40001';
  end if;
  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_assets) with ordinality loop
    if jsonb_typeof(v_entry.value) <> 'object'
      or (select count(*) from jsonb_object_keys(v_entry.value)) <> 5
      or not (v_entry.value ?& array['asset_id', 'asset_type', 'ciphertext',
        'nonce', 'ciphertext_digest']) then
      raise exception 'Encrypted package asset input is invalid.' using errcode = '22023';
    end if;
    if (v_entry.value ->> 'asset_id')::uuid = any(v_asset_ids) then
      raise exception 'Encrypted package asset is duplicated.' using errcode = '22023';
    end if;
    v_asset_ids := array_append(v_asset_ids, (v_entry.value ->> 'asset_id')::uuid);
    select * into v_asset from public.vault_assets
    where id = (v_entry.value ->> 'asset_id')::uuid
      and user_id = p_owner_user_id and deleted_at is null for update;
    v_asset_digest := encode(extensions.digest(concat_ws('|', v_asset.id::text,
      v_asset.asset_type, v_asset.ciphertext, v_asset.nonce), 'sha256'), 'hex');
    if v_asset.id is null or v_asset.updated_at > v_prepared_at
      or v_asset.asset_type <> v_entry.value ->> 'asset_type'
      or v_asset.ciphertext <> v_entry.value ->> 'ciphertext'
      or v_asset.nonce <> v_entry.value ->> 'nonce'
      or v_asset_digest <> v_entry.value ->> 'ciphertext_digest'
      or length(v_asset.ciphertext) not between 16 and 1048576
      or v_asset.ciphertext !~ '^[A-Za-z0-9_-]+$'
      or length(v_asset.nonce) not between 16 and 256
      or v_asset.nonce !~ '^[A-Za-z0-9_-]+$' then
      raise exception 'Encrypted package asset authority changed.' using errcode = '40001';
    end if;
    v_total_ciphertext_length := v_total_ciphertext_length + length(v_asset.ciphertext);
    v_snapshot_boundary := greatest(v_snapshot_boundary, v_asset.updated_at);
    v_asset_manifest := v_asset_manifest || concat_ws(':', v_entry.ordinal::text,
      v_asset.id::text, v_asset_digest) || '|';
  end loop;
  if v_total_ciphertext_length > 10485760 then
    raise exception 'Encrypted package ciphertext total is too large.' using errcode = '22023';
  end if;
  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_grants) with ordinality loop
    if jsonb_typeof(v_entry.value) <> 'object'
      or (select count(*) from jsonb_object_keys(v_entry.value)) <> 5
      or not (v_entry.value ?& array['grant_id', 'grant_version', 'recipient_key_id',
        'recipient_key_version', 'sealed_grant_digest']) then
      raise exception 'Encrypted package grant input is invalid.' using errcode = '22023';
    end if;
    if (v_entry.value ->> 'grant_id')::uuid = any(v_grant_ids) then
      raise exception 'Encrypted package grant is duplicated.' using errcode = '22023';
    end if;
    v_grant_ids := array_append(v_grant_ids, (v_entry.value ->> 'grant_id')::uuid);
    select grant_record.* into v_grant
    from public.claimant_recipient_grants grant_record
    join public.claimant_case_device_keys case_key
      on case_key.case_id = grant_record.case_id
        and case_key.key_id = grant_record.recipient_key_id
    join public.claimant_device_keys device_key
      on device_key.id = case_key.key_id
        and device_key.claimant_user_id = case_key.claimant_user_id
    where grant_record.id = (v_entry.value ->> 'grant_id')::uuid
      and grant_record.case_id = p_case_id and grant_record.status = 'active'
      and grant_record.owner_user_id = p_owner_user_id
      and grant_record.claimant_user_id = v_case.claimant_user_id
      and case_key.status = 'active' and device_key.status = 'active'
      and grant_record.recipient_key_version = device_key.key_version for update of grant_record;
    v_grant_digest := encode(extensions.digest(concat_ws('|', v_grant.id::text,
      v_grant.grant_version::text, v_grant.recipient_key_id::text,
      v_grant.recipient_key_version::text, v_grant.protocol, v_grant.profile,
      v_grant.key_agreement, v_grant.kdf, v_grant.aead,
      v_grant.owner_ephemeral_public_key, v_grant.nonce, v_grant.ciphertext),
      'sha256'), 'hex');
    if v_grant.id is null
      or v_grant.grant_version <> (v_entry.value ->> 'grant_version')::integer
      or v_grant.recipient_key_id <> (v_entry.value ->> 'recipient_key_id')::uuid
      or v_grant.recipient_key_version <>
        (v_entry.value ->> 'recipient_key_version')::integer
      or v_grant_digest <> v_entry.value ->> 'sealed_grant_digest' then
      raise exception 'Encrypted package grant authority changed.' using errcode = '40001';
    end if;
    v_grant_manifest := v_grant_manifest || concat_ws(':', v_entry.ordinal::text,
      v_grant.id::text, v_grant_digest) || '|';
  end loop;
  v_manifest_digest := encode(extensions.digest(concat_ws('|',
    'sanduqkin:claim:release-package-preparation:v1', p_package_id::text,
    p_case_id::text, p_expected_case_version::text, p_release_authorization_id::text,
    p_cycle_id::text, p_review_round_id::text, v_asset_manifest, v_grant_manifest),
    'sha256'), 'hex');
  insert into public.claimant_release_packages (id, package_ref, case_id,
    release_authorization_id, cycle_id, review_round_id, owner_user_id, claimant_user_id,
    case_version, asset_count, grant_count, asset_snapshot_boundary,
    preparation_manifest_digest, prepared_at, expires_at)
  values (p_package_id, p_package_ref, p_case_id, p_release_authorization_id,
    p_cycle_id, p_review_round_id, p_owner_user_id, v_case.claimant_user_id,
    p_expected_case_version, v_asset_count, v_grant_count, v_snapshot_boundary,
    v_manifest_digest, v_prepared_at, v_prepared_at + interval '72 hours')
  returning * into v_package;
  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_assets) with ordinality loop
    select * into v_asset from public.vault_assets
    where id = (v_entry.value ->> 'asset_id')::uuid and user_id = p_owner_user_id;
    v_asset_digest := encode(extensions.digest(concat_ws('|', v_asset.id::text,
      v_asset.asset_type, v_asset.ciphertext, v_asset.nonce), 'sha256'), 'hex');
    insert into public.claimant_release_package_assets (package_id, case_id, ordinal,
      source_asset_id, asset_type, source_updated_at, ciphertext, nonce, ciphertext_digest)
    values (p_package_id, p_case_id, v_entry.ordinal, v_asset.id, v_asset.asset_type,
      v_asset.updated_at, v_asset.ciphertext, v_asset.nonce, v_asset_digest);
  end loop;
  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_grants) with ordinality loop
    select * into v_grant from public.claimant_recipient_grants
    where id = (v_entry.value ->> 'grant_id')::uuid;
    insert into public.claimant_release_package_grants (package_id, case_id, ordinal,
      grant_id, grant_version, recipient_key_id, recipient_key_version,
      sealed_grant_digest)
    values (p_package_id, p_case_id, v_entry.ordinal, v_grant.id,
      v_grant.grant_version, v_grant.recipient_key_id, v_grant.recipient_key_version,
      v_entry.value ->> 'sealed_grant_digest');
  end loop;
  insert into public.claimant_release_package_events (package_id, case_id, event_type,
    actor_user_id, idempotency_key)
  values (p_package_id, p_case_id, 'encrypted_package_prepared',
    p_owner_user_id, p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id,
    'case_version', v_case.version, 'case_state', v_case.state,
    'release_authorization_id', p_release_authorization_id,
    'release_package_id', v_package.id, 'package_status', v_package.status,
    'asset_count', v_package.asset_count, 'grant_count', v_package.grant_count,
    'manifest_signed', false, 'retrieval_authorized', false,
    'replayed', false);
  insert into public.claimant_release_package_idempotency (operation, case_id,
    owner_user_id, idempotency_key, request_digest, result)
  values ('prepare_encrypted_release_package', p_case_id, p_owner_user_id,
    p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Encrypted package conflicts with existing authority.'
    using errcode = '40001';
end $function$;

create or replace function public.claimant_finalize_signed_release_package(
  p_case_id uuid, p_package_id uuid, p_release_authorization_id uuid,
  p_signing_authority_id uuid, p_signing_key_id uuid,
  p_expected_signing_key_version integer, p_verified_public_key_digest text,
  p_expected_case_version integer,
  p_finalization_id uuid, p_manifests jsonb, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_package public.claimant_release_packages%rowtype;
  v_authorization public.claimant_release_authorizations%rowtype;
  v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_round public.claimant_review_rounds%rowtype;
  v_release_authority public.claimant_release_authority_identities%rowtype;
  v_signing_authority public.claimant_release_signing_authorities%rowtype;
  v_signing_key public.claimant_release_signing_keys%rowtype;
  v_existing public.claimant_release_package_finalization_idempotency%rowtype;
  v_grant record; v_entry record; v_manifest jsonb; v_release_material jsonb;
  v_request_digest text; v_manifest_digest text; v_manifest_set text := '';
  v_manifest_set_digest text; v_expected_asset_digests jsonb; v_expected_grant_digest text;
  v_manifest_count integer; v_finalized_at timestamptz := now(); v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'claimant:signed-release-package:' || p_case_id::text, 0));
  if p_expected_case_version < 3 or p_expected_signing_key_version < 1
    or p_verified_public_key_digest !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_manifests) <> 'array' then
    raise exception 'Signed package input is invalid.' using errcode = '22023';
  end if;
  v_manifest_count := jsonb_array_length(p_manifests);
  if v_manifest_count not between 2 and 10 then
    raise exception 'Signed manifest bounds are invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_package_id::text, p_release_authorization_id::text, p_signing_authority_id::text,
    p_signing_key_id::text, p_expected_signing_key_version::text,
    p_verified_public_key_digest, p_expected_case_version::text,
    p_finalization_id::text, p_manifests::text),
    'sha256'), 'hex');
  select * into v_existing from public.claimant_release_package_finalization_idempotency
  where operation = 'finalize_signed_release_package' and case_id = p_case_id
    and signing_authority_id = p_signing_authority_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was used with different finalization input.'
        using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_package from public.claimant_release_packages
  where id = p_package_id and case_id = p_case_id;
  select * into v_authorization from public.claimant_release_authorizations
  -- Append-only record; mutable case, review, and authorities are locked separately.
  where id = p_release_authorization_id and case_id = p_case_id;
  select * into v_cycle from public.claimant_owner_protection_cycles
  where id = v_package.cycle_id and case_id = p_case_id for update;
  select * into v_round from public.claimant_review_rounds
  where id = v_package.review_round_id and case_id = p_case_id for update;
  select * into v_release_authority from public.claimant_release_authority_identities
  where id = v_authorization.authority_identity_id for update;
  select * into v_signing_authority from public.claimant_release_signing_authorities
  where id = p_signing_authority_id for update;
  select * into v_signing_key from public.claimant_release_signing_keys
  where id = p_signing_key_id and authority_id = p_signing_authority_id for update;
  if v_case.id is null or v_case.state <> 'approved'
    or v_case.version <> p_expected_case_version
    or v_package.id is null or v_package.case_version <> p_expected_case_version
    or v_package.release_authorization_id <> p_release_authorization_id
    or v_package.status <> 'prepared_unsigned' or v_package.manifest_signed
    or v_package.retrieval_authorized or v_package.expires_at <= v_finalized_at
    or v_authorization.id is null
    or v_authorization.authorized_case_version <> p_expected_case_version
    or v_authorization.status <> 'authorized' or not v_authorization.release_authorized
    or v_authorization.package_creation_authorized or v_authorization.retrieval_authorized
    or v_authorization.policy_pack_id <> v_case.policy_pack_id
    or v_authorization.policy_pack_version <> v_case.policy_pack_version
    or v_cycle.id is null or v_cycle.status <> 'delivery_verified'
    or v_cycle.cooldown_expires_at is null or v_cycle.cooldown_expires_at > v_finalized_at
    or v_round.id is null or not ((v_round.status = 'two_person_approved'
        and v_round.two_person_approval_satisfied and v_round.review_mode = 'two_person'
        and v_authorization.review_mode = 'two_person')
      or (v_round.status = 'single_approved' and v_round.review_mode = 'single_approver'
        and not v_round.two_person_approval_satisfied
        and v_authorization.review_mode = 'single_approver'))
    or v_round.release_authorized
    or v_round.round_version <> v_authorization.review_round_version
    or v_release_authority.id is null or v_release_authority.status <> 'active'
    or not v_release_authority.synthetic_only or v_release_authority.live_release_authority
    or v_signing_authority.id is null or v_signing_authority.status <> 'active'
    or not v_signing_authority.synthetic_only or v_signing_authority.live_signing_authority
    or v_signing_authority.user_id in (v_case.owner_user_id, v_case.claimant_user_id,
      v_release_authority.user_id)
    or v_signing_key.id is null or v_signing_key.status <> 'active'
    or v_signing_key.key_version <> p_expected_signing_key_version
    or v_signing_key.signature_algorithm <> 'ed25519'
    or not v_signing_key.synthetic_only
    or v_finalized_at < v_signing_key.valid_from or v_finalized_at >= v_signing_key.valid_until
    or v_signing_key.public_key_digest <> p_verified_public_key_digest
    or v_signing_key.public_key_digest <> encode(extensions.digest(
      decode(translate(v_signing_key.public_key, '-_', '+/') ||
        repeat('=', (4 - length(v_signing_key.public_key) % 4) % 4), 'base64'),
      'sha256'), 'hex')
    or exists (select 1 from public.claimant_review_interventions intervention
      where intervention.case_id = p_case_id)
    or exists (select 1 from public.claimant_reviewer_identities reviewer
      where reviewer.user_id = v_signing_authority.user_id)
    or exists (select 1 from public.claimant_review_resolution_authorities resolution
      where resolution.user_id = v_signing_authority.user_id) then
    raise exception 'Signed package authority changed.' using errcode = '42501';
  end if;
  if v_manifest_count <> v_package.grant_count
    or (select count(*) from public.claimant_release_package_grants
      where package_id = p_package_id) <> v_package.grant_count
    or (select count(*) from public.claimant_release_package_assets
      where package_id = p_package_id) <> v_package.asset_count then
    raise exception 'Signed package membership changed.' using errcode = '40001';
  end if;
  if exists (select 1 from public.claimant_release_package_assets package_asset
    left join public.vault_assets asset on asset.id = package_asset.source_asset_id
      and asset.user_id = v_package.owner_user_id and asset.deleted_at is null
    where package_asset.package_id = p_package_id and (asset.id is null
      or asset.asset_type <> package_asset.asset_type
      or asset.updated_at <> package_asset.source_updated_at
      or asset.ciphertext <> package_asset.ciphertext or asset.nonce <> package_asset.nonce)) then
    raise exception 'Signed package asset authority changed.' using errcode = '40001';
  end if;
  select jsonb_agg(to_jsonb(rtrim(translate(encode(extensions.digest(
    decode(translate(package_asset.ciphertext, '-_', '+/') ||
      repeat('=', (4 - length(package_asset.ciphertext) % 4) % 4), 'base64'),
    'sha256'), 'base64'), '+/', '-_'), '=')) order by package_asset.ordinal)
  into v_expected_asset_digests from public.claimant_release_package_assets package_asset
  where package_asset.package_id = p_package_id;
  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_manifests) with ordinality loop
    if jsonb_typeof(v_entry.value) <> 'object'
      or (select count(*) from jsonb_object_keys(v_entry.value)) <> 6
      or not (v_entry.value ?& array['manifest_id', 'grant_id', 'canonical_manifest',
        'manifest_digest', 'detached_signature', 'signature_verified_at']) then
      raise exception 'Signed manifest input is invalid.' using errcode = '22023';
    end if;
    select package_grant.*, source_grant.protocol as source_protocol,
      source_grant.profile as source_profile, source_grant.key_agreement,
      source_grant.kdf, source_grant.aead, source_grant.owner_ephemeral_public_key,
      source_grant.nonce as source_nonce, source_grant.ciphertext as source_ciphertext,
      source_grant.status as source_status, device_key.status as key_status,
      device_key.key_version as current_key_version, case_key.status as case_key_status
    into v_grant from public.claimant_release_package_grants package_grant
    join public.claimant_recipient_grants source_grant on source_grant.id = package_grant.grant_id
    join public.claimant_case_device_keys case_key on case_key.case_id = source_grant.case_id
      and case_key.key_id = source_grant.recipient_key_id
      and case_key.claimant_user_id = source_grant.claimant_user_id
    join public.claimant_device_keys device_key on device_key.id = case_key.key_id
      and device_key.claimant_user_id = case_key.claimant_user_id
    where package_grant.package_id = p_package_id and package_grant.ordinal = v_entry.ordinal
      for update of source_grant;
    if v_grant.grant_id is null
      or v_grant.grant_id <> (v_entry.value ->> 'grant_id')::uuid
      or v_grant.source_status <> 'active' or v_grant.key_status <> 'active'
      or v_grant.case_key_status <> 'active'
      or v_grant.current_key_version <> v_grant.recipient_key_version
      or v_grant.sealed_grant_digest <> encode(extensions.digest(concat_ws('|',
        v_grant.grant_id::text, v_grant.grant_version::text,
        v_grant.recipient_key_id::text, v_grant.recipient_key_version::text,
        v_grant.source_protocol, v_grant.source_profile, v_grant.key_agreement,
        v_grant.kdf, v_grant.aead, v_grant.owner_ephemeral_public_key,
        v_grant.source_nonce, v_grant.source_ciphertext), 'sha256'), 'hex') then
      raise exception 'Signed package grant authority changed.' using errcode = '40001';
    end if;
    begin v_manifest := (v_entry.value ->> 'canonical_manifest')::jsonb;
    exception when others then
      raise exception 'Signed manifest JSON is invalid.' using errcode = '22023';
    end;
    v_manifest_digest := encode(extensions.digest(
      v_entry.value ->> 'canonical_manifest', 'sha256'), 'hex');
    v_release_material := v_manifest -> 'release_material';
    v_expected_grant_digest := rtrim(translate(encode(extensions.digest(
      decode(translate(v_grant.source_ciphertext, '-_', '+/') ||
        repeat('=', (4 - length(v_grant.source_ciphertext) % 4) % 4), 'base64'),
      'sha256'), 'base64'), '+/', '-_'), '=');
    if v_manifest_digest <> v_entry.value ->> 'manifest_digest'
      or (v_entry.value ->> 'signature_verified_at')::timestamptz > v_finalized_at
      or (v_entry.value ->> 'signature_verified_at')::timestamptz <
        v_finalized_at - interval '5 minutes'
      or (select count(*) from jsonb_object_keys(v_manifest)) <> 14
      or v_manifest ->> 'protocol' <> 'sanduqkin:claim:release-package:v1'
      or (v_manifest ->> 'claim_id')::uuid <> p_case_id
      or (v_manifest ->> 'release_package_id')::uuid <> p_package_id
      or (v_manifest ->> 'owner_id')::uuid <> v_package.owner_user_id
      or (v_manifest ->> 'claimant_id')::uuid <> v_package.claimant_user_id
      or (v_manifest ->> 'claim_version')::integer <> p_expected_case_version
      or (v_manifest ->> 'cancellation_version')::integer <> v_cycle.cycle_number
      or (v_manifest ->> 'created_at')::timestamptz <> v_package.prepared_at
      or (v_manifest ->> 'expires_at')::timestamptz <> v_package.expires_at
      or (v_manifest ->> 'asset_snapshot_boundary')::timestamptz <>
        v_package.asset_snapshot_boundary
      or v_manifest -> 'asset_ciphertext_digests' <> v_expected_asset_digests
      or (v_manifest ->> 'policy_decision_version')::integer <>
        v_authorization.policy_pack_version
      or v_manifest ->> 'signing_key_id' <> v_signing_key.signing_key_id
      or (select count(*) from jsonb_object_keys(v_release_material)) <> 7
      or v_release_material ->> 'profile' <> 'registered_recipient_v1'
      or (v_release_material ->> 'grant_id')::uuid <> v_grant.grant_id
      or (v_release_material ->> 'grant_version')::integer <> v_grant.grant_version
      or (v_release_material ->> 'recipient_id')::uuid <> v_package.claimant_user_id
      or (v_release_material ->> 'recipient_key_id')::uuid <> v_grant.recipient_key_id
      or (v_release_material ->> 'recipient_key_version')::integer <>
        v_grant.recipient_key_version
      or v_release_material ->> 'sealed_grant_digest' <> v_expected_grant_digest then
      raise exception 'Signed manifest binding changed.' using errcode = '40001';
    end if;
    v_manifest_set := v_manifest_set || concat_ws(':', v_entry.ordinal::text,
      v_grant.grant_id::text, v_manifest_digest) || '|';
  end loop;
  v_manifest_set_digest := encode(extensions.digest(concat_ws('|',
    'sanduqkin:claim:signed-manifest-set:v1', v_package.preparation_manifest_digest,
    v_manifest_set), 'sha256'), 'hex');
  insert into public.claimant_release_package_finalizations (id, package_id, case_id,
    release_authorization_id, signing_authority_id, signing_key_id, source_case_version,
    finalized_case_version, preparation_manifest_digest, signed_manifest_set_digest,
    manifest_count, finalized_at, expires_at)
  values (p_finalization_id, p_package_id, p_case_id, p_release_authorization_id,
    p_signing_authority_id, p_signing_key_id, p_expected_case_version,
    p_expected_case_version + 1, v_package.preparation_manifest_digest,
    v_manifest_set_digest, v_manifest_count, v_finalized_at, v_package.expires_at);
  for v_entry in select value, ordinality::integer as ordinal
    from jsonb_array_elements(p_manifests) with ordinality loop
    insert into public.claimant_release_signed_manifests (id, finalization_id,
      package_id, case_id, ordinal, grant_id, signing_key_id, canonical_manifest,
      manifest_digest, detached_signature, signature_verified_at)
    values ((v_entry.value ->> 'manifest_id')::uuid, p_finalization_id,
      p_package_id, p_case_id, v_entry.ordinal, (v_entry.value ->> 'grant_id')::uuid,
      p_signing_key_id, v_entry.value ->> 'canonical_manifest',
      v_entry.value ->> 'manifest_digest', v_entry.value ->> 'detached_signature',
      (v_entry.value ->> 'signature_verified_at')::timestamptz);
  end loop;
  update public.claimant_cases set state = 'release_ready',
    version = version + 1, updated_at = v_finalized_at
  where id = p_case_id and state = 'approved' and version = p_expected_case_version;
  if not found then
    raise exception 'Signed package case changed.' using errcode = '40001';
  end if;
  insert into public.claimant_release_package_finalization_events (finalization_id,
    case_id, event_type, actor_user_id, idempotency_key)
  values (p_finalization_id, p_case_id, 'release_package_finalized',
    v_signing_authority.user_id, p_idempotency_key);
  v_result := jsonb_build_object('case_id', p_case_id,
    'case_version', p_expected_case_version + 1, 'case_state', 'release_ready',
    'release_package_id', p_package_id, 'finalization_id', p_finalization_id,
    'finalization_status', 'finalized_release_ready',
    'manifest_count', v_manifest_count, 'manifest_signed', true,
    'retrieval_authorized', false, 'replayed', false);
  insert into public.claimant_release_package_finalization_idempotency (operation,
    case_id, signing_authority_id, idempotency_key, request_digest, result)
  values ('finalize_signed_release_package', p_case_id, p_signing_authority_id,
    p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Signed package conflicts with existing finalization.'
    using errcode = '40001';
end $function$;
