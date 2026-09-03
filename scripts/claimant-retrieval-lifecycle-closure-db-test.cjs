const { execFileSync } = require("node:child_process");
const { createHash, randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { buildClaimantRetrievalCompletionDbTestSql } =
  require("./claimant-retrieval-completion-db-test.cjs");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const accessMigration = readFileSync(join(__dirname,
  "../supabase/migrations/20260819000000_claimant_retrieval_suspension_expiry.sql"), "utf8");
const migration = readFileSync(join(__dirname,
  "../supabase/migrations/20260819010000_claimant_retrieval_lifecycle_closure.sql"), "utf8");
const digest = (value) => createHash("sha256").update(value).digest("hex");

function fixture(options) {
  const base = buildClaimantRetrievalCompletionDbTestSql({ standalone: options.standalone });
  const fixtureEnd = base.indexOf("set local role service_role;\ndo $test$");
  if (fixtureEnd < 0) throw new Error("Retrieval-completion fixture boundary was missing.");
  return base.slice(0, fixtureEnd);
}

function buildClosureSql(options = {}, withExport = false) {
  const id = Object.fromEntries(["delivery", "prepare", "commit", "completion", "complete",
    "closure", "close", "hostile"].map((name) => [name, randomUUID()]));
  const sessionDigest = digest(`claimant-package-open.v1.${randomUUID()}`);
  const receiptDigest = withExport ? digest(`claimant-local-export.v1.${randomUUID()}`) : null;
  const factDigest = withExport ? digest(`verified-export-fact.${randomUUID()}`) : null;
  const marker = withExport ? "CLAIMANT_RETRIEVAL_EXPORTED_CLOSURE_DB_TEST_PASSED"
    : "CLAIMANT_RETRIEVAL_CLOSURE_DB_TEST_PASSED";
  return `${fixture(options)}
${options.standalone ? `${accessMigration}\n${migration}` : ""}
set local role service_role;
do $test$
declare v_case public.claimant_cases%rowtype;
  v_session public.claimant_release_retrieval_sessions%rowtype;
  v_prepared jsonb; v_result jsonb; v_opened timestamptz; v_exported timestamptz;
  v_delivery_key text := 'synthetic_package_delivery_slice_4j_${withExport ? "export" : "plain"}';
  v_receipt_ref text := 'synthetic_delivery_receipt_slice_4j_${withExport ? "export" : "plain"}';
  v_delivery_receipt_digest text; v_payload_digest text; v_manifest_digest text;
  v_payload_bytes integer; v_proof_digest text;
begin
  select * into v_case from public.claimant_cases;
  select * into v_session from public.claimant_release_retrieval_sessions;
  v_prepared := public.claimant_prepare_encrypted_package_delivery('${id.delivery}',
    v_delivery_key, v_session.id, v_case.id, 7, '${id.prepare}');
  v_payload_digest := v_prepared ->> 'payload_digest';
  v_payload_bytes := (v_prepared ->> 'payload_bytes')::integer;
  v_opened := date_trunc('milliseconds', clock_timestamp());
  v_delivery_receipt_digest := encode(extensions.digest(concat_ws('|',
    'sanduqkin:claim:encrypted-delivery-receipt:v1', v_delivery_key,
    v_payload_digest, v_payload_bytes::text,
    to_char(v_opened at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    v_receipt_ref), 'sha256'), 'hex');
  perform public.claimant_commit_encrypted_package_delivery('${id.delivery}',
    v_delivery_key, v_payload_digest, v_payload_bytes, v_opened,
    v_receipt_ref, v_delivery_receipt_digest, '${id.commit}');
  select manifest_digest into v_manifest_digest
  from public.claimant_release_signed_manifests where grant_id = v_session.grant_id;
  v_proof_digest := encode(extensions.digest(concat_ws('|',
    'sanduqkin:claim:native-open-proof:v1', '${id.completion}', '${id.delivery}',
    v_delivery_key, v_session.id::text, v_case.id::text, v_session.package_id::text,
    v_session.portal_session_id::text, v_session.recipient_key_id::text,
    '${"A".repeat(42)}E', '4', '5', '1.0.0', '2', v_payload_digest,
    v_manifest_digest, '${sessionDigest}',
    to_char(v_opened at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'false'), 'sha256'), 'hex');
  perform public.claimant_complete_verified_native_open('${id.completion}', '${id.delivery}',
    v_delivery_key, v_session.id, v_case.id, v_session.package_id,
    v_session.portal_session_id, v_session.recipient_key_id, '${"A".repeat(42)}E',
    4, 5, '1.0.0', 2, v_payload_digest, v_manifest_digest, '${sessionDigest}',
    v_opened, v_proof_digest, '${id.complete}');
  v_exported := ${withExport ? "v_opened + interval '1 second'" : "null"};
  begin perform public.claimant_close_retrieval_lifecycle('${id.hostile}',
    '${id.completion}', '${id.delivery}', v_session.id, v_case.id, v_session.package_id,
    7, 'retrieval_lifecycle_complete', ${withExport},
    ${withExport ? `'${receiptDigest}', '${factDigest}'` : "null, null"}, v_exported,
    '${id.hostile}');
    raise exception 'stale case version was accepted';
  exception when serialization_failure then null; end;
  v_result := public.claimant_close_retrieval_lifecycle('${id.closure}',
    '${id.completion}', '${id.delivery}', v_session.id, v_case.id, v_session.package_id,
    8, 'retrieval_lifecycle_complete', ${withExport},
    ${withExport ? `'${receiptDigest}', '${factDigest}'` : "null, null"}, v_exported,
    '${id.close}');
  if not (v_result ->> 'closure_recorded')::boolean
    or (v_result ->> 'export_performed')::boolean <> ${withExport}
    or (v_result ->> 'local_content_recalled')::boolean
    or (v_result ->> 'local_content_deleted')::boolean
    or not (v_result ->> 'historical_delivery_preserved')::boolean
    or not (v_result ->> 'historical_completion_preserved')::boolean then
    raise exception 'closure result made an unsafe claim'; end if;
  if not (public.claimant_close_retrieval_lifecycle('${id.closure}',
    '${id.completion}', '${id.delivery}', v_session.id, v_case.id, v_session.package_id,
    8, 'retrieval_lifecycle_complete', ${withExport},
    ${withExport ? `'${receiptDigest}', '${factDigest}'` : "null, null"}, v_exported,
    '${id.close}') ->> 'replayed')::boolean then
    raise exception 'closure replay was unstable'; end if;
  if (select state from public.claimant_cases) <> 'released'
    or (select version from public.claimant_cases) <> 8
    or (select status from public.claimant_encrypted_package_deliveries) <> 'served'
    or not (select package_served from public.claimant_encrypted_package_deliveries)
    or not (select retrieval_completed from public.claimant_encrypted_package_deliveries)
    or (select status from public.claimant_release_retrieval_sessions) <> 'completed_opened'
    or not (select retrieval_completed from public.claimant_release_retrieval_sessions)
    or (select export_performed from public.claimant_retrieval_completions)
    or (select closure_recorded from public.claimant_retrieval_completions)
    or (select count(*) from public.claimant_retrieval_lifecycle_closures) <> 1
    or (select count(*) from public.claimant_retrieval_lifecycle_closure_events) <> 1
    or (select count(*) from public.claimant_retrieval_lifecycle_closure_idempotency) <> 1
    or (select export_performed from public.claimant_retrieval_lifecycle_closures) <> ${withExport}
    or (select local_content_recalled from public.claimant_retrieval_lifecycle_closures)
    or (select local_content_deleted from public.claimant_retrieval_lifecycle_closures) then
    raise exception 'closure did not preserve historical truth'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_retrieval_lifecycle_closures;
    raise exception 'authenticated role read closure';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_close_retrieval_lifecycle('${id.closure}',
    '${id.completion}', '${id.delivery}',
    (select id from public.claimant_release_retrieval_sessions),
    (select id from public.claimant_cases), (select id from public.claimant_release_packages),
    8, 'retrieval_lifecycle_complete', false, null, null, null, '${id.hostile}');
    raise exception 'authenticated role called closure';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
rollback;
select '${marker}';`;
}

function runSql(sql, container, marker) {
  const output = execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres",
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], { encoding: "utf8", input: sql });
  if (!output.includes(marker)) throw new Error(`${marker} was missing.`);
}
function runClaimantRetrievalLifecycleClosureDbTest(options = {}) {
  const container = options.container ?? DEFAULT_CONTAINER;
  runSql(buildClosureSql(options, false), container, "CLAIMANT_RETRIEVAL_CLOSURE_DB_TEST_PASSED");
  runSql(buildClosureSql(options, true), container,
    "CLAIMANT_RETRIEVAL_EXPORTED_CLOSURE_DB_TEST_PASSED");
}

if (require.main === module) {
  const standalone = process.argv.includes("--standalone");
  const flag = process.argv.indexOf("--container");
  runClaimantRetrievalLifecycleClosureDbTest({ standalone,
    container: flag >= 0 ? process.argv[flag + 1] : undefined });
  console.log("Claimant retrieval lifecycle closure DB tests passed.");
}
module.exports = { buildClosureSql, runClaimantRetrievalLifecycleClosureDbTest };
