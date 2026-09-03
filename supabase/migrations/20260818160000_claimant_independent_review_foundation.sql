do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.claimant_submission_receipts'::regclass
      and conname = 'claimant_submission_receipts_case_version_unique'
  ) then
    alter table public.claimant_submission_receipts
    add constraint claimant_submission_receipts_case_version_unique
    unique (case_id, case_version);
  end if;
end $migration$;

create table public.claimant_review_rounds (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  cycle_id uuid not null,
  case_version integer not null check (case_version > 1),
  submission_case_version integer not null check (submission_case_version > 1),
  intake_version integer not null check (intake_version > 1),
  preparation_version integer not null check (preparation_version > 1),
  policy_pack_id text not null check (policy_pack_id ~ '^synthetic_policy_[a-z0-9_]{1,100}$'),
  policy_pack_version integer not null check (policy_pack_version > 0),
  checklist_digest text not null check (checklist_digest ~ '^[0-9a-f]{64}$'),
  evidence_manifest_digest text not null check (evidence_manifest_digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (
    status in ('pending', 'two_person_approved', 'rejected', 'held')
  ),
  round_version integer not null default 1 check (round_version > 0),
  two_person_approval_satisfied boolean not null default false,
  release_authorized boolean not null default false check (not release_authorized),
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at),
  check ((status = 'pending' and not two_person_approval_satisfied and completed_at is null)
    or (status = 'two_person_approved' and two_person_approval_satisfied and completed_at is not null)
    or (status in ('rejected', 'held') and not two_person_approval_satisfied
      and completed_at is not null)),
  unique (case_id, cycle_id),
  unique (id, case_id),
  foreign key (cycle_id, case_id)
    references public.claimant_owner_protection_cycles(id, case_id) on delete restrict,
  foreign key (case_id, submission_case_version)
    references public.claimant_submission_receipts(case_id, case_version) on delete restrict
);

create table public.claimant_review_decisions (
  id uuid primary key default gen_random_uuid(),
  review_round_id uuid not null,
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  assignment_id uuid not null,
  reviewer_identity_id uuid not null
    references public.claimant_reviewer_identities(id) on delete restrict,
  assignment_slot smallint not null check (assignment_slot in (1, 2)),
  assignment_version integer not null check (assignment_version > 0),
  decision text not null check (decision in ('allow', 'reject', 'hold')),
  reason_class text not null check (reason_class in (
    'requirements_satisfied', 'authority_not_established', 'identity_not_established',
    'relationship_not_established', 'evidence_inconsistent', 'more_information_needed',
    'conflict_or_dispute', 'policy_review_required'
  )),
  case_version integer not null check (case_version > 1),
  intake_version integer not null check (intake_version > 1),
  preparation_version integer not null check (preparation_version > 1),
  policy_pack_id text not null,
  policy_pack_version integer not null check (policy_pack_version > 0),
  checklist_digest text not null check (checklist_digest ~ '^[0-9a-f]{64}$'),
  evidence_manifest_digest text not null check (evidence_manifest_digest ~ '^[0-9a-f]{64}$'),
  synthetic_only boolean not null default true check (synthetic_only),
  recorded_at timestamptz not null default now(),
  unique (review_round_id, assignment_slot),
  unique (review_round_id, assignment_id),
  unique (review_round_id, reviewer_identity_id),
  foreign key (review_round_id, case_id)
    references public.claimant_review_rounds(id, case_id) on delete restrict,
  foreign key (assignment_id, case_id)
    references public.claimant_reviewer_assignments(id, case_id) on delete restrict
);

create table public.claimant_review_events (
  id uuid primary key default gen_random_uuid(),
  review_round_id uuid not null,
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  decision_id uuid not null references public.claimant_review_decisions(id) on delete restrict,
  event_type text not null check (event_type in (
    'independent_review_recorded', 'two_person_review_completed'
  )),
  reviewer_identity_id uuid not null
    references public.claimant_reviewer_identities(id) on delete restrict,
  reason_class text not null,
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and metadata = '{}'::jsonb),
  unique (case_id, idempotency_key, event_type),
  foreign key (review_round_id, case_id)
    references public.claimant_review_rounds(id, case_id) on delete restrict
);

create table public.claimant_review_idempotency (
  operation text not null check (operation = 'record_independent_review'),
  case_id uuid not null references public.claimant_cases(id) on delete restrict,
  reviewer_identity_id uuid not null
    references public.claimant_reviewer_identities(id) on delete restrict,
  idempotency_key uuid not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (operation, case_id, reviewer_identity_id, idempotency_key)
);

revoke all on table public.claimant_review_rounds from public;
revoke all on table public.claimant_review_rounds from anon;
revoke all on table public.claimant_review_rounds from authenticated;
revoke all on table public.claimant_review_decisions from public;
revoke all on table public.claimant_review_decisions from anon;
revoke all on table public.claimant_review_decisions from authenticated;
revoke all on table public.claimant_review_events from public;
revoke all on table public.claimant_review_events from anon;
revoke all on table public.claimant_review_events from authenticated;
revoke all on table public.claimant_review_idempotency from public;
revoke all on table public.claimant_review_idempotency from anon;
revoke all on table public.claimant_review_idempotency from authenticated;
grant select, insert, update on table public.claimant_review_rounds to service_role;
grant select, insert on table public.claimant_review_decisions to service_role;
grant select, insert on table public.claimant_review_events to service_role;
grant select, insert on table public.claimant_review_idempotency to service_role;

alter table public.claimant_review_rounds enable row level security;
alter table public.claimant_review_rounds force row level security;
alter table public.claimant_review_decisions enable row level security;
alter table public.claimant_review_decisions force row level security;
alter table public.claimant_review_events enable row level security;
alter table public.claimant_review_events force row level security;
alter table public.claimant_review_idempotency enable row level security;
alter table public.claimant_review_idempotency force row level security;
create policy "Claimant review rounds are server-only."
on public.claimant_review_rounds for all to anon, authenticated using (false) with check (false);
create policy "Claimant review decisions are server-only."
on public.claimant_review_decisions for all to anon, authenticated using (false) with check (false);
create policy "Claimant review events are server-only."
on public.claimant_review_events for all to anon, authenticated using (false) with check (false);
create policy "Claimant review idempotency is server-only."
on public.claimant_review_idempotency for all to anon, authenticated using (false) with check (false);

create function public.claimant_record_independent_review(
  p_case_id uuid, p_cycle_id uuid, p_assignment_id uuid, p_reviewer_identity_id uuid,
  p_expected_case_version integer, p_expected_assignment_version integer,
  p_expected_submission_case_version integer, p_expected_intake_version integer,
  p_expected_preparation_version integer, p_policy_pack_id text,
  p_policy_pack_version integer, p_checklist_digest text, p_evidence_manifest_digest text,
  p_decision text, p_reason_class text, p_idempotency_key uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_case public.claimant_cases%rowtype;
  v_cycle public.claimant_owner_protection_cycles%rowtype;
  v_assignment public.claimant_reviewer_assignments%rowtype;
  v_receipt public.claimant_submission_receipts%rowtype;
  v_intake public.claimant_intake_snapshots%rowtype;
  v_round public.claimant_review_rounds%rowtype;
  v_decision public.claimant_review_decisions%rowtype;
  v_existing public.claimant_review_idempotency%rowtype;
  v_request_digest text; v_checklist_digest text; v_evidence_digest text;
  v_decision_count integer; v_allow_count integer; v_reject_count integer;
  v_status text; v_result jsonb;
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
    raise exception 'Independent review input is invalid.' using errcode = '22023';
  end if;
  v_request_digest := encode(extensions.digest(concat_ws('|', p_case_id::text,
    p_cycle_id::text, p_assignment_id::text, p_reviewer_identity_id::text,
    p_expected_case_version::text, p_expected_assignment_version::text,
    p_expected_submission_case_version::text, p_expected_intake_version::text,
    p_expected_preparation_version::text, p_policy_pack_id, p_policy_pack_version::text,
    p_checklist_digest, p_evidence_manifest_digest, p_decision, p_reason_class), 'sha256'), 'hex');
  select * into v_existing from public.claimant_review_idempotency
  where operation = 'record_independent_review' and case_id = p_case_id
    and reviewer_identity_id = p_reviewer_identity_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_digest <> v_request_digest then
      raise exception 'Idempotency key was used with different review input.' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('replayed', true);
  end if;
  select * into v_case from public.claimant_cases where id = p_case_id for update;
  select * into v_cycle from public.claimant_owner_protection_cycles
  where id = p_cycle_id and case_id = p_case_id for update;
  select * into v_assignment from public.claimant_reviewer_assignments
  where id = p_assignment_id and case_id = p_case_id for update;
  select * into v_receipt from public.claimant_submission_receipts where case_id = p_case_id;
  select * into v_intake from public.claimant_intake_snapshots where case_id = p_case_id;
  if v_case.id is null or v_case.state <> 'cooldown' or v_case.version <> p_expected_case_version
    or v_case.policy_pack_id <> p_policy_pack_id
    or v_case.policy_pack_version <> p_policy_pack_version
    or v_cycle.id is null or v_cycle.status <> 'delivery_verified'
    or v_cycle.cooldown_expires_at is null or v_cycle.cooldown_expires_at > now()
    or v_assignment.id is null or v_assignment.cycle_id <> p_cycle_id
    or v_assignment.status <> 'assigned'
    or v_assignment.reviewer_identity_id <> p_reviewer_identity_id
    or v_assignment.assignment_version <> p_expected_assignment_version
    or not exists (select 1 from public.claimant_reviewer_identities reviewer
      where reviewer.id = p_reviewer_identity_id and reviewer.status = 'active'
        and reviewer.synthetic_only and not reviewer.live_review_authority)
    or v_receipt.case_id is null or v_receipt.case_version <> p_expected_submission_case_version
    or v_receipt.intake_version <> p_expected_intake_version
    or v_receipt.preparation_version <> p_expected_preparation_version
    or v_receipt.review_started or v_receipt.release_authorized
    or v_intake.case_id is null or v_intake.version <> p_expected_intake_version
    or v_intake.policy_pack_id <> p_policy_pack_id
    or v_intake.policy_pack_version <> p_policy_pack_version
    or v_intake.status not in ('ready_for_review', 'manual_review') then
    raise exception 'Independent review authority changed.' using errcode = '40001';
  end if;
  select encode(extensions.digest(coalesce(string_agg(
    item_key || ':' || availability, '|' order by item_key), ''), 'sha256'), 'hex')
  into v_checklist_digest from public.claimant_checklist_items where case_id = p_case_id;
  if v_checklist_digest <> p_checklist_digest
    or exists (select 1 from public.claimant_checklist_items
      where case_id = p_case_id and availability = 'pending') then
    raise exception 'Review checklist authority changed.' using errcode = '40001';
  end if;
  select encode(extensions.digest(coalesce(string_agg(
    object.id::text || ':' || object.version::text || ':' || object.content_digest,
    '|' order by object.id::text), ''), 'sha256'), 'hex')
  into v_evidence_digest
  from public.claimant_evidence_objects object
  join public.claimant_evidence_upload_capabilities capability
    on capability.id = object.capability_id and capability.case_id = object.case_id
  where object.case_id = p_case_id and capability.preparation_version = p_expected_preparation_version
    and object.status = 'clean';
  if v_evidence_digest <> p_evidence_manifest_digest
    or (select count(*) from public.claimant_evidence_objects object
      join public.claimant_evidence_upload_capabilities capability
        on capability.id = object.capability_id and capability.case_id = object.case_id
      where object.case_id = p_case_id
        and capability.preparation_version = p_expected_preparation_version
        and object.status = 'clean') <> v_receipt.evidence_object_count then
    raise exception 'Review evidence authority changed.' using errcode = '40001';
  end if;
  select * into v_round from public.claimant_review_rounds
  where case_id = p_case_id and cycle_id = p_cycle_id for update;
  if v_round.id is null then
    insert into public.claimant_review_rounds (case_id, cycle_id, case_version,
      submission_case_version, intake_version, preparation_version, policy_pack_id,
      policy_pack_version, checklist_digest, evidence_manifest_digest)
    values (p_case_id, p_cycle_id, p_expected_case_version,
      p_expected_submission_case_version, p_expected_intake_version,
      p_expected_preparation_version, p_policy_pack_id, p_policy_pack_version,
      p_checklist_digest, p_evidence_manifest_digest) returning * into v_round;
  elsif v_round.status <> 'pending' or v_round.case_version <> p_expected_case_version
    or v_round.submission_case_version <> p_expected_submission_case_version
    or v_round.intake_version <> p_expected_intake_version
    or v_round.preparation_version <> p_expected_preparation_version
    or v_round.policy_pack_id <> p_policy_pack_id
    or v_round.policy_pack_version <> p_policy_pack_version
    or v_round.checklist_digest <> p_checklist_digest
    or v_round.evidence_manifest_digest <> p_evidence_manifest_digest then
    raise exception 'Independent review round changed.' using errcode = '40001';
  end if;
  if exists (select 1 from public.claimant_review_decisions
      where review_round_id = v_round.id and (assignment_id = p_assignment_id
        or reviewer_identity_id = p_reviewer_identity_id
        or assignment_slot = v_assignment.assignment_slot)) then
    raise exception 'Independent reviewer already decided.' using errcode = '40001';
  end if;
  insert into public.claimant_review_decisions (review_round_id, case_id, assignment_id,
    reviewer_identity_id, assignment_slot, assignment_version, decision, reason_class,
    case_version, intake_version, preparation_version, policy_pack_id, policy_pack_version,
    checklist_digest, evidence_manifest_digest)
  values (v_round.id, p_case_id, p_assignment_id, p_reviewer_identity_id,
    v_assignment.assignment_slot, v_assignment.assignment_version, p_decision, p_reason_class,
    p_expected_case_version, p_expected_intake_version, p_expected_preparation_version,
    p_policy_pack_id, p_policy_pack_version, p_checklist_digest, p_evidence_manifest_digest)
  returning * into v_decision;
  insert into public.claimant_review_events (review_round_id, case_id, decision_id,
    event_type, reviewer_identity_id, reason_class, idempotency_key)
  values (v_round.id, p_case_id, v_decision.id, 'independent_review_recorded',
    p_reviewer_identity_id, p_reason_class, p_idempotency_key);
  if exists (select 1 from public.claimant_review_decisions decision
      join public.claimant_reviewer_assignments assignment
        on assignment.id = decision.assignment_id and assignment.case_id = decision.case_id
      join public.claimant_reviewer_identities reviewer
        on reviewer.id = decision.reviewer_identity_id
      where decision.review_round_id = v_round.id
        and (assignment.status <> 'assigned'
          or assignment.assignment_version <> decision.assignment_version
          or assignment.reviewer_identity_id <> decision.reviewer_identity_id
          or reviewer.status <> 'active' or not reviewer.synthetic_only
          or reviewer.live_review_authority)) then
    raise exception 'Independent review assignment authority changed.' using errcode = '40001';
  end if;
  select count(*), count(*) filter (where decision = 'allow'),
    count(*) filter (where decision = 'reject')
  into v_decision_count, v_allow_count, v_reject_count
  from public.claimant_review_decisions where review_round_id = v_round.id;
  if v_decision_count = 2 then
    v_status := case when v_allow_count = 2 then 'two_person_approved'
      when v_reject_count > 0 then 'rejected' else 'held' end;
    update public.claimant_review_rounds set status = v_status,
      two_person_approval_satisfied = v_status = 'two_person_approved',
      round_version = round_version + 1, completed_at = now(), updated_at = now()
    where id = v_round.id and status = 'pending' returning * into v_round;
    insert into public.claimant_review_events (review_round_id, case_id, decision_id,
      event_type, reviewer_identity_id, reason_class, idempotency_key)
    values (v_round.id, p_case_id, v_decision.id, 'two_person_review_completed',
      p_reviewer_identity_id, p_reason_class, p_idempotency_key);
  end if;
  v_result := jsonb_build_object('case_id', p_case_id, 'case_version', v_case.version,
    'cycle_id', p_cycle_id, 'review_round_id', v_round.id,
    'round_version', v_round.round_version, 'review_status', v_round.status,
    'review_complete', v_round.status <> 'pending',
    'two_person_approval_satisfied', v_round.two_person_approval_satisfied,
    'release_authorized', false, 'replayed', false);
  insert into public.claimant_review_idempotency (operation, case_id, reviewer_identity_id,
    idempotency_key, request_digest, result)
  values ('record_independent_review', p_case_id, p_reviewer_identity_id,
    p_idempotency_key, v_request_digest, v_result - 'replayed');
  return v_result;
exception when unique_violation then
  raise exception 'Independent review conflicts with existing authority.' using errcode = '40001';
end $function$;

revoke all on function public.claimant_record_independent_review(
  uuid, uuid, uuid, uuid, integer, integer, integer, integer, integer,
  text, integer, text, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.claimant_record_independent_review(
  uuid, uuid, uuid, uuid, integer, integer, integer, integer, integer,
  text, integer, text, text, text, text, uuid
) to service_role;
