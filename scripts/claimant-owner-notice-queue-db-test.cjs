const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const migrationNames = ["20260804134000_claimant_registered_recipient_foundation.sql",
  "20260804150000_claimant_registered_recipient_mutations.sql",
  "20260804170000_claimant_session_assurance.sql",
  "20260804190000_claimant_registered_recipient_lifecycle.sql",
  "20260804210000_claimant_portal_session_boundary.sql",
  "20260812130000_claimant_app_attest_persistence.sql",
  "20260812150000_claimant_native_enrollment_challenges.sql",
  "20260812170000_claimant_native_enrollment_controller_authority.sql",
  "20260812190000_claimant_native_enrollment_reconciliation.sql",
  "20260812210000_claimant_intake_checklist_foundation.sql",
  "20260812220000_claimant_evidence_preparation_metadata.sql",
  "20260812230000_claimant_private_evidence_quarantine.sql",
  "20260813000000_claimant_upload_reconciliation_authority.sql",
  "20260813010000_claimant_submission_acknowledgement.sql",
  "20260818010000_claimant_owner_protection_foundation.sql",
  "20260818075248_claimant_owner_notice_delivery_queue.sql"];

function migrations() { return migrationNames.map((name) => readFileSync(join(__dirname,
  "../supabase/migrations", name), "utf8")).join("\n"); }

function buildClaimantOwnerNoticeQueueDbTestSql() {
  const names = ["owner", "claimant", "invitation", "key", "case", "begin", "stale"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  return `begin;
${migrations()}
insert into auth.users (id) values ('${id.owner}'), ('${id.claimant}');
insert into public.claimant_identities (user_id, status) values ('${id.claimant}', 'active');
insert into public.claimant_invitations (id, owner_user_id, recipient_address_digest, status,
  accepted_by_user_id, expires_at, accepted_at)
values ('${id.invitation}', '${id.owner}', repeat('a', 64), 'accepted', '${id.claimant}',
  now() + interval '1 hour', now());
insert into public.claimant_device_keys (id, claimant_user_id, device_binding_digest, public_key_jwk)
values ('${id.key}', '${id.claimant}', repeat('b', 64),
  '{"kty":"EC","crv":"P-256","x":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","y":"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"}'::jsonb);
insert into public.claimant_cases (id, claimant_user_id, owner_user_id, invitation_id, current_key_id,
  state, policy_pack_id, policy_pack_version, version)
values ('${id.case}', '${id.claimant}', '${id.owner}', '${id.invitation}', '${id.key}',
  'submitted', 'synthetic_policy_death_alpha', 1, 3);
insert into public.claimant_submission_receipts (case_id, claimant_user_id, submission_ref,
  acknowledgement_ref, submission_digest, case_version, intake_version, preparation_version,
  evidence_object_count, unavailable_item_count, status, review_started, release_authorized,
  claimed_created_at, synthetic_only)
values ('${id.case}', '${id.claimant}', 'synthetic_submission_alpha_001',
  'synthetic_acknowledgement_${"a".repeat(32)}', repeat('c', 64), 3, 9, 2, 1, 0,
  'received_for_review', false, false, now(), true);
set local role service_role;
do $test$
declare v_begin jsonb; v_first jsonb; v_retry jsonb; v_result jsonb; v_complete jsonb;
begin
  v_begin := public.claimant_begin_owner_notice('${id.case}', 3,
    'synthetic_owner_notice_alpha_001', 2592000, '${id.begin}');
  v_first := public.claimant_claim_owner_notice_delivery(60);
  if v_first is null or (v_first ->> 'attempt_number')::integer <> 1
    or v_first ->> 'case_id' <> '${id.case}'
    or v_first ->> 'dispatch_key' <> 'owner-notice:' || (v_first ->> 'outbox_id') || ':'
      || (v_first ->> 'delivery_idempotency_key')
    or v_first ->> 'lease_token' is null then
    raise exception 'first owner-notice lease was invalid';
  end if;
  if public.claimant_claim_owner_notice_delivery(60) is not null then
    raise exception 'active owner-notice lease was claimed twice';
  end if;
  update public.claimant_owner_notice_deliveries set lease_expires_at = now() - interval '1 second'
  where outbox_id = (v_first ->> 'outbox_id')::uuid;
  v_retry := public.claimant_claim_owner_notice_delivery(60);
  if (v_retry ->> 'attempt_number')::integer <> 2
    or v_retry ->> 'dispatch_key' <> v_first ->> 'dispatch_key'
    or v_retry ->> 'delivery_idempotency_key' <> v_first ->> 'delivery_idempotency_key'
    or v_retry ->> 'lease_token' = v_first ->> 'lease_token' then
    raise exception 'expired lease did not preserve stable delivery authority';
  end if;
  begin
    perform public.claimant_complete_owner_notice_delivery(
      (v_retry ->> 'outbox_id')::uuid, (v_first ->> 'lease_token')::uuid, '${id.case}',
      (v_retry ->> 'cycle_id')::uuid, (v_retry ->> 'delivery_idempotency_key')::uuid,
      5, 'verified');
    raise exception 'stale lease completed owner notice';
  exception when serialization_failure then null; end;
  v_result := public.claimant_record_owner_notice_delivery('${id.case}',
    (v_retry ->> 'cycle_id')::uuid, 4, 'synthetic_owner_notice_alpha_001', 'verified',
    repeat('d', 64), (v_retry ->> 'delivery_idempotency_key')::uuid);
  v_complete := public.claimant_complete_owner_notice_delivery(
    (v_retry ->> 'outbox_id')::uuid, (v_retry ->> 'lease_token')::uuid, '${id.case}',
    (v_retry ->> 'cycle_id')::uuid, (v_retry ->> 'delivery_idempotency_key')::uuid,
    (v_result ->> 'case_version')::integer, 'verified');
  if v_complete ->> 'status' <> 'delivered'
    or (select status from public.claimant_outbox
      where id = (v_retry ->> 'outbox_id')::uuid) <> 'delivered'
    or public.claimant_claim_owner_notice_delivery(60) is not null then
    raise exception 'owner-notice completion did not become terminal';
  end if;
  if public.claimant_complete_owner_notice_delivery(
    (v_retry ->> 'outbox_id')::uuid, (v_retry ->> 'lease_token')::uuid, '${id.case}',
    (v_retry ->> 'cycle_id')::uuid, (v_retry ->> 'delivery_idempotency_key')::uuid,
    5, 'verified') <> v_complete then raise exception 'completion replay changed'; end if;
  begin
    perform public.claimant_complete_owner_notice_delivery(
      (v_retry ->> 'outbox_id')::uuid, '${id.stale}', '${id.case}',
      (v_retry ->> 'cycle_id')::uuid, (v_retry ->> 'delivery_idempotency_key')::uuid,
      5, 'verified');
    raise exception 'changed terminal replay was accepted';
  exception when serialization_failure then null; end;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform public.claimant_claim_owner_notice_delivery(60);
    raise exception 'authenticated role claimed owner notice';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.claimant_owner_notice_deliveries;
    raise exception 'authenticated role read owner notice delivery';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_OWNER_NOTICE_QUEUE_DB_TEST_PASSED' as result;`;
}

function runClaimantOwnerNoticeQueueDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildClaimantOwnerNoticeQueueDbTestSql() });
  if (!output.includes("CLAIMANT_OWNER_NOTICE_QUEUE_DB_TEST_PASSED")) {
    throw new Error("Claimant owner-notice queue DB test marker was missing.");
  }
}

if (process.argv.includes("--emit-hosted-sql")) {
  process.stdout.write(buildClaimantOwnerNoticeQueueDbTestSql());
} else if (require.main === module) {
  runClaimantOwnerNoticeQueueDbTest(); console.log("Claimant owner-notice queue DB test passed.");
}
module.exports = { buildClaimantOwnerNoticeQueueDbTestSql, runClaimantOwnerNoticeQueueDbTest };
