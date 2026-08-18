const { execFileSync } = require("node:child_process");
const { createHash, randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { buildClaimantRetrievalCompletionDbTestSql } =
  require("./claimant-retrieval-completion-db-test.cjs");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const migration = readFileSync(join(__dirname,
  "../supabase/migrations/20260819000000_claimant_retrieval_suspension_expiry.sql"), "utf8");
const digest = (value) => createHash("sha256").update(value).digest("hex");

function fixture(options) {
  const base = buildClaimantRetrievalCompletionDbTestSql({ standalone: options.standalone });
  const fixtureEnd = base.indexOf("set local role service_role;\ndo $test$");
  if (fixtureEnd < 0) throw new Error("Retrieval-completion fixture boundary was missing.");
  return base.slice(0, fixtureEnd);
}

function buildSuspensionSql(options = {}) {
  const id = Object.fromEntries(["delivery", "prepare", "commit", "control", "end",
    "completion", "complete", "hostile"].map((name) => [name, randomUUID()]));
  const sessionDigest = digest(`claimant-package-open.v1.${randomUUID()}`);
  return `${fixture(options)}
${migration}
set local role service_role;
do $test$
declare v_case public.claimant_cases%rowtype;
  v_session public.claimant_release_retrieval_sessions%rowtype;
  v_prepared jsonb; v_result jsonb; v_opened timestamptz;
  v_delivery_key text := 'synthetic_package_delivery_slice_4h';
  v_receipt_ref text := 'synthetic_delivery_receipt_slice_4h';
  v_receipt_digest text; v_payload_digest text; v_manifest_digest text;
  v_payload_bytes integer; v_proof_digest text;
begin
  select * into v_case from public.claimant_cases;
  select * into v_session from public.claimant_release_retrieval_sessions;
  v_prepared := public.claimant_prepare_encrypted_package_delivery('${id.delivery}',
    v_delivery_key, v_session.id, v_case.id, 7, '${id.prepare}');
  v_payload_digest := v_prepared ->> 'payload_digest';
  v_payload_bytes := (v_prepared ->> 'payload_bytes')::integer;
  v_opened := date_trunc('milliseconds', clock_timestamp());
  v_receipt_digest := encode(extensions.digest(concat_ws('|',
    'sanduqkin:claim:encrypted-delivery-receipt:v1', v_delivery_key,
    v_payload_digest, v_payload_bytes::text,
    to_char(v_opened at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    v_receipt_ref), 'sha256'), 'hex');
  perform public.claimant_commit_encrypted_package_delivery('${id.delivery}',
    v_delivery_key, v_payload_digest, v_payload_bytes, v_opened,
    v_receipt_ref, v_receipt_digest, '${id.commit}');
  begin perform public.claimant_end_release_retrieval_access('${id.hostile}',
    v_session.finalization_id, v_case.id, 7, 'suspended',
    'synthetic_security_hold', '${id.hostile}');
    raise exception 'stale case version was accepted';
  exception when serialization_failure then null; end;
  v_result := public.claimant_end_release_retrieval_access('${id.control}',
    v_session.finalization_id, v_case.id, 8, 'suspended',
    'synthetic_security_hold', '${id.end}');
  if v_result ->> 'control_state' <> 'suspended'
    or not (v_result ->> 'package_was_served')::boolean
    or (v_result ->> 'retrieval_was_completed')::boolean
    or (v_result ->> 'future_serving_authorized')::boolean
    or (v_result ->> 'future_retrieval_authorized')::boolean
    or (v_result ->> 'local_content_recalled')::boolean
    or (v_result ->> 'local_content_deleted')::boolean then
    raise exception 'suspension result made an unsafe claim'; end if;
  if not (public.claimant_end_release_retrieval_access('${id.control}',
    v_session.finalization_id, v_case.id, 8, 'suspended',
    'synthetic_security_hold', '${id.end}') ->> 'replayed')::boolean then
    raise exception 'suspension replay was unstable'; end if;
  select manifest_digest into v_manifest_digest
  from public.claimant_release_signed_manifests
  where grant_id = v_session.grant_id;
  v_proof_digest := encode(extensions.digest(concat_ws('|',
    'sanduqkin:claim:native-open-proof:v1', '${id.completion}', '${id.delivery}',
    v_delivery_key, v_session.id::text, v_case.id::text,
    v_session.package_id::text, v_session.portal_session_id::text,
    v_session.recipient_key_id::text, '${"A".repeat(42)}E', '4', '5',
    '1.0.0', '2', v_payload_digest, v_manifest_digest, '${sessionDigest}',
    to_char(v_opened at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'false'), 'sha256'), 'hex');
  begin perform public.claimant_complete_verified_native_open('${id.completion}',
    '${id.delivery}', v_delivery_key, v_session.id, v_case.id, v_session.package_id,
    v_session.portal_session_id, v_session.recipient_key_id, '${"A".repeat(42)}E',
    4, 5, '1.0.0', 2, v_payload_digest, v_manifest_digest, '${sessionDigest}',
    v_opened, v_proof_digest, '${id.complete}');
    raise exception 'completion after suspension was accepted';
  exception when serialization_failure then null; end;
  if (select state from public.claimant_cases) <> 'released'
    or (select version from public.claimant_cases) <> 8
    or (select status from public.claimant_release_package_finalizations) <> 'suspended'
    or (select status from public.claimant_release_retrieval_sessions)
      <> 'access_ended_served_unrecalled'
    or (select package_serving_authorized from public.claimant_release_retrieval_sessions)
    or not (select package_served from public.claimant_release_retrieval_sessions)
    or (select retrieval_completed from public.claimant_release_retrieval_sessions)
    or (select status from public.claimant_encrypted_package_deliveries)
      <> 'access_ended_served_unrecalled'
    or not (select package_served from public.claimant_encrypted_package_deliveries)
    or (select retrieval_completed from public.claimant_encrypted_package_deliveries)
    or (select count(*) from public.claimant_retrieval_completions) <> 0
    or (select assertion_counter from public.claimant_app_attest_keys) <> 4
    or (select count(*) from public.claimant_retrieval_access_controls) <> 1
    or (select count(*) from public.claimant_retrieval_access_control_events) <> 1
    or (select local_content_recalled from public.claimant_retrieval_access_controls)
    or (select local_content_deleted from public.claimant_retrieval_access_controls) then
    raise exception 'suspension did not preserve historical truth'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_retrieval_access_controls;
    raise exception 'authenticated role read access control';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_end_release_retrieval_access('${id.control}',
    (select id from public.claimant_release_package_finalizations),
    (select id from public.claimant_cases), 8, 'suspended',
    'synthetic_security_hold', '${id.hostile}');
    raise exception 'authenticated role ended access';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_RETRIEVAL_SUSPENSION_DB_TEST_PASSED';`;
}

function buildExpirySql(options = {}) {
  const id = Object.fromEntries(["control", "end", "delivery", "prepare"]
    .map((name) => [name, randomUUID()]));
  return `${fixture(options)}
${migration}
set local role service_role;
update public.claimant_release_package_finalizations
set expires_at = now() - interval '1 second';
do $test$
declare v_case public.claimant_cases%rowtype;
  v_session public.claimant_release_retrieval_sessions%rowtype; v_result jsonb;
begin
  select * into v_case from public.claimant_cases;
  select * into v_session from public.claimant_release_retrieval_sessions;
  v_result := public.claimant_end_release_retrieval_access('${id.control}',
    v_session.finalization_id, v_case.id, 7, 'expired', 'package_expired', '${id.end}');
  if v_result ->> 'control_state' <> 'expired'
    or (v_result ->> 'package_was_served')::boolean
    or (v_result ->> 'retrieval_was_completed')::boolean
    or (v_result ->> 'future_serving_authorized')::boolean
    or (v_result ->> 'future_retrieval_authorized')::boolean then
    raise exception 'expiry result was unsafe'; end if;
  begin perform public.claimant_prepare_encrypted_package_delivery('${id.delivery}',
    'synthetic_package_delivery_expired_slice_4h', v_session.id, v_case.id, 7,
    '${id.prepare}');
    raise exception 'delivery after expiry was accepted';
  exception when invalid_authorization_specification then null; end;
  if (select state from public.claimant_cases) <> 'release_ready'
    or (select version from public.claimant_cases) <> 7
    or (select status from public.claimant_release_package_finalizations) <> 'expired'
    or (select status from public.claimant_release_retrieval_sessions)
      <> 'access_ended_unserved'
    or (select access_state from public.claimant_release_retrieval_sessions) <> 'expired'
    or (select count(*) from public.claimant_encrypted_package_deliveries) <> 0
    or (select count(*) from public.claimant_retrieval_access_controls) <> 1 then
    raise exception 'expiry did not end unserved authority'; end if;
end $test$;
reset role;
rollback;
select 'CLAIMANT_RETRIEVAL_EXPIRY_DB_TEST_PASSED';`;
}

function runSql(sql, container, marker) {
  const output = execFileSync("docker", ["exec", "-i", container,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: sql });
  if (!output.includes(marker)) throw new Error(`${marker} was missing.`);
}
function runClaimantRetrievalAccessControlDbTest(options = {}) {
  const container = options.container ?? DEFAULT_CONTAINER;
  runSql(buildSuspensionSql(options), container, "CLAIMANT_RETRIEVAL_SUSPENSION_DB_TEST_PASSED");
  runSql(buildExpirySql(options), container, "CLAIMANT_RETRIEVAL_EXPIRY_DB_TEST_PASSED");
}

if (require.main === module) {
  const standalone = process.argv.includes("--standalone");
  const flag = process.argv.indexOf("--container");
  runClaimantRetrievalAccessControlDbTest({ standalone,
    container: flag >= 0 ? process.argv[flag + 1] : undefined });
  console.log("Claimant retrieval access-control DB tests passed.");
}
module.exports = { buildExpirySql, buildSuspensionSql,
  runClaimantRetrievalAccessControlDbTest };
