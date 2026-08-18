const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const localMigrationNames = ["20260812210000_claimant_intake_checklist_foundation.sql",
  "20260812220000_claimant_evidence_preparation_metadata.sql",
  "20260812230000_claimant_private_evidence_quarantine.sql",
  "20260813000000_claimant_upload_reconciliation_authority.sql",
  "20260813010000_claimant_submission_acknowledgement.sql",
  "20260818010000_claimant_owner_protection_foundation.sql"];
const hostedMigrationNames = ["20260804134000_claimant_registered_recipient_foundation.sql",
  "20260804150000_claimant_registered_recipient_mutations.sql",
  "20260804170000_claimant_session_assurance.sql",
  "20260804190000_claimant_registered_recipient_lifecycle.sql",
  "20260804210000_claimant_portal_session_boundary.sql",
  "20260812130000_claimant_app_attest_persistence.sql",
  "20260812150000_claimant_native_enrollment_challenges.sql",
  "20260812170000_claimant_native_enrollment_controller_authority.sql",
  "20260812190000_claimant_native_enrollment_reconciliation.sql",
  ...localMigrationNames];

function readMigrations(names) {
  return names.map((name) => readFileSync(join(__dirname,
    "../supabase/migrations", name), "utf8")).join("\n");
}

function buildClaimantOwnerProtectionDbTestSql(options = {}) {
  const names = ["owner", "claimant", "other", "invitation", "key", "case", "cycle",
    "begin", "delivery", "stop", "hostile", "collision"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  const begin = (attempt = id.begin, cooldown = 2592000) =>
    `public.claimant_begin_owner_notice('${id.case}', 3,
      'synthetic_owner_notice_alpha_001', ${cooldown}, '${attempt}')`;
  const delivery = (outcome, attempt, digest = "null", cycle = `'${id.cycle}'`) =>
    `public.claimant_record_owner_notice_delivery('${id.case}', ${cycle}, 4,
      'synthetic_owner_notice_alpha_001', '${outcome}', ${digest}, '${attempt}')`;
  const stop = (reason, actor, attempt, expected = 5, cycle = `'${id.cycle}'`) =>
    `public.claimant_stop_owner_protection('${id.case}', ${cycle}, ${expected},
      '${reason}', ${actor}, '${attempt}')`;
  const migrations = readMigrations(options.fullPrerequisites ? hostedMigrationNames : localMigrationNames);
  return `
begin;
${migrations}
insert into auth.users (id) values ('${id.owner}'), ('${id.claimant}'), ('${id.other}');
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
insert into public.claimant_outbox(topic, aggregate_type, aggregate_id, dedupe_key, payload)
values ('owner_notice_requested', 'case', '${id.case}',
  'owner_notice_requested:${id.begin}', '{"event":"collision"}'::jsonb);
do $test$
declare v_result jsonb; v_state text; v_version integer; v_cycle_id uuid;
begin
  begin
    perform ${begin()};
    raise exception 'late owner-notice outbox collision did not fail';
  exception when unique_violation then null;
  end;
  select state, version into v_state, v_version from public.claimant_cases where id = '${id.case}';
  if v_state <> 'submitted' or v_version <> 3
    or exists (select 1 from public.claimant_owner_protection_cycles where case_id = '${id.case}')
    or exists (select 1 from public.claimant_owner_protection_events where case_id = '${id.case}')
    or exists (select 1 from public.claimant_owner_protection_idempotency where case_id = '${id.case}') then
    raise exception 'late owner-notice failure partially committed';
  end if;
  update public.claimant_outbox set dedupe_key = 'collision-moved:${id.collision}'
  where dedupe_key = 'owner_notice_requested:${id.begin}';
  v_result := ${begin()};
  if v_result ->> 'state' <> 'owner_notified' or v_result ->> 'status' <> 'pending_delivery'
    or (v_result ->> 'case_version')::integer <> 4 or (v_result ->> 'cooldown_active')::boolean
    or (v_result ->> 'release_authorized')::boolean or (v_result ->> 'review_started')::boolean then
    raise exception 'owner notice result was unsafe';
  end if;
  v_cycle_id := (v_result ->> 'cycle_id')::uuid;
  v_result := ${begin()};
  if not (v_result ->> 'replayed')::boolean then raise exception 'begin replay was unstable'; end if;
  begin
    perform ${begin(id.begin, 2592001)};
    raise exception 'changed begin replay was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    v_result := ${delivery("failed", id.hostile, "null", "v_cycle_id")};
    if v_result ->> 'state' <> 'on_hold' or v_result ->> 'status' <> 'delivery_failed'
      or (v_result ->> 'cooldown_active')::boolean then raise exception 'delivery failure did not hold'; end if;
    raise exception 'ROLLBACK_DELIVERY_FAILURE' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ROLLBACK_DELIVERY_FAILURE' then raise; end if;
  end;
  begin
    perform ${delivery("verified", id.hostile, "null", "v_cycle_id")};
    raise exception 'verified delivery accepted without evidence';
  exception when invalid_parameter_value then null;
  end;
  v_result := ${delivery("verified", id.delivery, `'${"d".repeat(64)}'`, "v_cycle_id")};
  if v_result ->> 'state' <> 'cooldown' or v_result ->> 'status' <> 'delivery_verified'
    or not (v_result ->> 'cooldown_active')::boolean
    or v_result ->> 'cooldown_expires_at' is null
    or (v_result ->> 'release_authorized')::boolean or (v_result ->> 'review_started')::boolean then
    raise exception 'verified delivery did not start safe cooldown';
  end if;
  begin
    perform ${stop("owner_cancelled", `'${id.other}'`, id.hostile, 5, "v_cycle_id")};
    raise exception 'unbound owner cancelled protection';
  exception when insufficient_privilege then null;
  end;
  begin
    v_result := ${stop("material_change", "null", id.hostile, 5, "v_cycle_id")};
    if v_result ->> 'state' <> 'on_hold' or v_result ->> 'status' <> 'invalidated' then
      raise exception 'material change did not invalidate to hold'; end if;
    raise exception 'ROLLBACK_INVALIDATION' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ROLLBACK_INVALIDATION' then raise; end if;
  end;
  v_result := ${stop("owner_cancelled", `'${id.owner}'`, id.stop, 5, "v_cycle_id")};
  if v_result ->> 'state' <> 'cancelled_by_owner' or v_result ->> 'status' <> 'cancelled'
    or (v_result ->> 'cooldown_active')::boolean
    or (v_result ->> 'release_authorized')::boolean or (v_result ->> 'review_started')::boolean then
    raise exception 'owner cancellation result was unsafe';
  end if;
  if (select count(*) from public.claimant_owner_protection_cycles where case_id = '${id.case}') <> 1
    or (select count(*) from public.claimant_owner_protection_events where case_id = '${id.case}') <> 3
    or (select count(*) from public.claimant_owner_protection_idempotency where case_id = '${id.case}') <> 3 then
    raise exception 'owner-protection atomic records were incomplete';
  end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform ${begin(randomUUID())};
    raise exception 'authenticated role began owner protection';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.claimant_owner_protection_cycles where case_id = '${id.case}';
    raise exception 'authenticated role read owner protection';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_OWNER_PROTECTION_DB_TEST_PASSED' as result;
`;
}

function runClaimantOwnerProtectionDbTest(options = {}) {
  const sql = buildClaimantOwnerProtectionDbTestSql(options);
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: sql });
  if (!output.includes("CLAIMANT_OWNER_PROTECTION_DB_TEST_PASSED")) {
    throw new Error("Claimant owner-protection DB test marker was missing.");
  }
}

if (process.argv.includes("--emit-hosted-sql")) {
  process.stdout.write(buildClaimantOwnerProtectionDbTestSql({ fullPrerequisites: true }));
} else if (require.main === module) {
  runClaimantOwnerProtectionDbTest(); console.log("Claimant owner-protection DB test passed.");
}
module.exports = { buildClaimantOwnerProtectionDbTestSql, runClaimantOwnerProtectionDbTest };
