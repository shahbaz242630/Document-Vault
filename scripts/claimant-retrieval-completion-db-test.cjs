const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { buildClaimantEncryptedPackageDeliveryDbTestSql } =
  require("./claimant-encrypted-package-delivery-db-test.cjs");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const migration = readFileSync(join(__dirname,
  "../supabase/migrations/20260818230000_claimant_retrieval_completion.sql"), "utf8");

const standaloneAppAttestSchema = `
create table public.claimant_app_attest_keys (
  id uuid primary key default gen_random_uuid(),
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  app_attest_key_id_digest text not null unique,
  app_id_hash text not null,
  public_key_spki_base64 text not null,
  attestation_receipt bytea not null,
  environment text not null,
  attested_bundle_version text not null,
  attested_validation_category integer not null,
  assertion_counter bigint not null default 0,
  last_asserted_bundle_version text,
  last_asserted_validation_category integer,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_asserted_at timestamptz,
  revoked_at timestamptz,
  unique (id, claimant_user_id)
);
create table public.claimant_app_attest_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  app_attest_key_id uuid not null,
  claimant_key_id uuid,
  idempotency_key uuid not null,
  assertion_counter bigint not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  foreign key (app_attest_key_id, claimant_user_id)
    references public.claimant_app_attest_keys(id, claimant_user_id) on delete restrict,
  foreign key (claimant_key_id, claimant_user_id)
    references public.claimant_device_keys(id, claimant_user_id) on delete restrict,
  unique (claimant_user_id, idempotency_key, event_type)
);
revoke all on table public.claimant_app_attest_keys from public, anon, authenticated;
revoke all on table public.claimant_app_attest_events from public, anon, authenticated;
grant select, insert, update on table public.claimant_app_attest_keys to service_role;
grant select, insert on table public.claimant_app_attest_events to service_role;
alter table public.claimant_app_attest_keys enable row level security;
alter table public.claimant_app_attest_keys force row level security;
alter table public.claimant_app_attest_events enable row level security;
alter table public.claimant_app_attest_events force row level security;
create policy "Claimant App Attest keys are server-only."
on public.claimant_app_attest_keys for all to anon, authenticated using (false) with check (false);
create policy "Claimant App Attest events are server-only."
on public.claimant_app_attest_events for all to anon, authenticated using (false) with check (false);
`;

function buildClaimantRetrievalCompletionDbTestSql(options = {}) {
  const base = buildClaimantEncryptedPackageDeliveryDbTestSql({ standalone: options.standalone });
  const fixtureEnd = base.indexOf("set local role service_role;\ndo $test$");
  if (fixtureEnd < 0) throw new Error("Encrypted-delivery fixture boundary was missing.");
  const fixture = base.slice(0, fixtureEnd);
  const names = ["delivery", "prepare", "commit", "completion", "complete", "hostile",
    "appKey", "wrongPortal"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  return `${fixture}
${options.standalone ? standaloneAppAttestSchema : ""}
${migration}
insert into public.claimant_app_attest_keys (id, claimant_user_id,
  app_attest_key_id_digest, app_id_hash, public_key_spki_base64,
  attestation_receipt, environment, attested_bundle_version,
  attested_validation_category, assertion_counter)
select '${id.appKey}', claimant_user_id, '${"A".repeat(42)}E', '${"B".repeat(42)}E',
  repeat('Q', 88), decode('AQ==', 'base64'), 'development', '1.0.0', 2, 4
from public.claimant_cases;
set local role service_role;
do $test$
declare v_case public.claimant_cases%rowtype; v_session public.claimant_release_retrieval_sessions%rowtype;
  v_prepared jsonb; v_served jsonb; v_completed jsonb; v_opened timestamptz;
  v_delivery_key text := 'synthetic_package_delivery_slice_4g';
  v_receipt_ref text := 'synthetic_delivery_receipt_slice_4g';
  v_receipt_digest text; v_session_digest text; v_proof_digest text;
  v_manifest_digest text; v_payload_digest text; v_payload_bytes integer;
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
  v_served := public.claimant_commit_encrypted_package_delivery('${id.delivery}',
    v_delivery_key, v_payload_digest, v_payload_bytes, v_opened,
    v_receipt_ref, v_receipt_digest, '${id.commit}');
  select manifest_digest into v_manifest_digest
  from public.claimant_release_signed_manifests
  where grant_id = v_session.grant_id;
  v_session_digest := encode(extensions.digest(
    'claimant-package-open.v1.${randomUUID()}', 'sha256'), 'hex');
  v_proof_digest := encode(extensions.digest(concat_ws('|',
    'sanduqkin:claim:native-open-proof:v1', '${id.completion}', '${id.delivery}',
    v_delivery_key, v_session.id::text, v_case.id::text,
    v_session.package_id::text, v_session.portal_session_id::text,
    v_session.recipient_key_id::text, '${"A".repeat(42)}E', '4', '5',
    '1.0.0', '2', v_payload_digest, v_manifest_digest, v_session_digest,
    to_char(v_opened at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'false'), 'sha256'), 'hex');
  begin perform public.claimant_complete_verified_native_open('${id.hostile}', '${id.delivery}',
    v_delivery_key, v_session.id, v_case.id, v_session.package_id,
    v_session.portal_session_id, v_session.recipient_key_id, '${"A".repeat(42)}E',
    3, 5, '1.0.0', 2, v_payload_digest, v_manifest_digest, v_session_digest,
    v_opened, repeat('0', 64), '${id.hostile}');
    raise exception 'stale counter was accepted';
  exception when serialization_failure then null; end;
  begin perform public.claimant_complete_verified_native_open('${id.hostile}', '${id.delivery}',
    v_delivery_key, v_session.id, v_case.id, v_session.package_id,
    '${id.wrongPortal}', v_session.recipient_key_id, '${"A".repeat(42)}E',
    4, 5, '1.0.0', 2, v_payload_digest, v_manifest_digest, v_session_digest,
    v_opened, repeat('0', 64), '${id.hostile}');
    raise exception 'wrong portal was accepted';
  exception when serialization_failure then null; end;
  begin perform public.claimant_complete_verified_native_open('${id.hostile}', '${id.delivery}',
    v_delivery_key, v_session.id, v_case.id, v_session.package_id,
    v_session.portal_session_id, v_session.recipient_key_id, '${"A".repeat(42)}E',
    4, 5, '1.0.0', 2, v_payload_digest, repeat('0', 64), v_session_digest,
    v_opened, repeat('0', 64), '${id.hostile}');
    raise exception 'wrong manifest was accepted';
  exception when serialization_failure then null; end;
  begin perform public.claimant_complete_verified_native_open('${id.hostile}', '${id.delivery}',
    v_delivery_key, v_session.id, v_case.id, v_session.package_id,
    v_session.portal_session_id, v_session.recipient_key_id, '${"A".repeat(42)}E',
    4, 5, '1.0.0', 2, v_payload_digest, v_manifest_digest, v_session_digest,
    v_opened + interval '2 minutes', repeat('0', 64), '${id.hostile}');
    raise exception 'future open was accepted';
  exception when serialization_failure then null; end;
  v_completed := public.claimant_complete_verified_native_open('${id.completion}',
    '${id.delivery}', v_delivery_key, v_session.id, v_case.id, v_session.package_id,
    v_session.portal_session_id, v_session.recipient_key_id, '${"A".repeat(42)}E',
    4, 5, '1.0.0', 2, v_payload_digest, v_manifest_digest, v_session_digest,
    v_opened, v_proof_digest, '${id.complete}');
  if v_completed ->> 'case_state' <> 'released'
    or (v_completed ->> 'case_version')::integer <> 8
    or not (v_completed ->> 'retrieval_completed')::boolean
    or (v_completed ->> 'export_performed')::boolean
    or (v_completed ->> 'closure_recorded')::boolean then
    raise exception 'completion result was unsafe'; end if;
  if not (public.claimant_complete_verified_native_open('${id.completion}',
    '${id.delivery}', v_delivery_key, v_session.id, v_case.id, v_session.package_id,
    v_session.portal_session_id, v_session.recipient_key_id, '${"A".repeat(42)}E',
    4, 5, '1.0.0', 2, v_payload_digest, v_manifest_digest, v_session_digest,
    v_opened, v_proof_digest, '${id.complete}') ->> 'replayed')::boolean then
    raise exception 'completion replay was unstable'; end if;
  if (select state from public.claimant_cases) <> 'released'
    or (select version from public.claimant_cases) <> 8
    or not (select retrieval_completed from public.claimant_encrypted_package_deliveries)
    or (select status from public.claimant_release_retrieval_sessions) <> 'completed_opened'
    or not (select retrieval_completed from public.claimant_release_retrieval_sessions)
    or (select assertion_counter from public.claimant_app_attest_keys) <> 5
    or (select count(*) from public.claimant_retrieval_completions) <> 1
    or (select count(*) from public.claimant_retrieval_completion_events) <> 1
    or (select count(*) from public.claimant_retrieval_completion_idempotency) <> 1
    or (select export_performed from public.claimant_retrieval_completions)
    or (select closure_recorded from public.claimant_retrieval_completions) then
    raise exception 'atomic completion records failed'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_retrieval_completions;
    raise exception 'authenticated role read completion';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_complete_verified_native_open('${id.completion}',
    '${id.delivery}', 'synthetic_package_delivery_slice_4g',
    (select id from public.claimant_release_retrieval_sessions),
    (select id from public.claimant_cases),
    (select id from public.claimant_release_packages),
    (select active_session_id from public.claimant_portal_session_controls),
    (select recipient_key_id from public.claimant_release_retrieval_sessions),
    '${"A".repeat(42)}E', 4, 5, '1.0.0', 2, repeat('0', 64),
    repeat('0', 64), repeat('0', 64), now(), repeat('0', 64), '${id.hostile}');
    raise exception 'authenticated role called completion';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_RETRIEVAL_COMPLETION_DB_TEST_PASSED';`;
}

function runClaimantRetrievalCompletionDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildClaimantRetrievalCompletionDbTestSql(options) });
  if (!output.includes("CLAIMANT_RETRIEVAL_COMPLETION_DB_TEST_PASSED"))
    throw new Error("Retrieval completion DB marker was missing.");
}

if (require.main === module) {
  const standalone = process.argv.includes("--standalone");
  const flag = process.argv.indexOf("--container");
  runClaimantRetrievalCompletionDbTest({ standalone,
    container: flag >= 0 ? process.argv[flag + 1] : undefined });
  console.log("Claimant retrieval completion DB test passed.");
}
module.exports = { buildClaimantRetrievalCompletionDbTestSql,
  runClaimantRetrievalCompletionDbTest };
