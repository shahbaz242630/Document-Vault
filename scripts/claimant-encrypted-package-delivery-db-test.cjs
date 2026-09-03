const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { buildClaimantRetrievalSessionDbTestSql } =
  require("./claimant-retrieval-session-db-test.cjs");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const migration = readFileSync(join(__dirname,
  "../supabase/migrations/20260818220000_claimant_encrypted_package_delivery.sql"), "utf8");

function buildClaimantEncryptedPackageDeliveryDbTestSql(options = {}) {
  const base = buildClaimantRetrievalSessionDbTestSql({ standalone: options.standalone });
  const fixtureEnd = base.indexOf("set local role service_role;");
  if (fixtureEnd < 0) throw new Error("Retrieval-session fixture boundary was missing.");
  const fixture = base.slice(0, fixtureEnd);
  const id = Object.fromEntries(["asset", "retrieval", "delivery", "prepare", "commit",
    "bad", "intervention"].map((name) => [name, randomUUID()]));
  const interventionInsert = options.standalone
    ? `insert into public.claimant_review_interventions values ('${id.intervention}', v_case.id);`
    : `insert into public.claimant_review_interventions(id, case_id, cycle_id, review_round_id,
        authority_identity_id, intervention_type, reason_class, source_review_status,
        source_round_version)
      select '${id.intervention}', release_auth.case_id, release_auth.cycle_id,
        release_auth.review_round_id, authority.id, 'escalation', 'policy_review_required',
        'two_person_approved', 2
      from public.claimant_release_authorizations release_auth
      join public.claimant_review_resolution_authorities authority
        on authority.id = release_auth.authority_identity_id
      where release_auth.case_id = v_case.id;`;
  return `${fixture}
${options.standalone ? migration : ""}
insert into public.vault_assets
select '${id.asset}', owner_user_id, 'document_location', repeat('V', 64), repeat('N', 24),
  now() - interval '2 hours', now() - interval '1 hour', null
from public.claimant_cases;
insert into public.claimant_release_package_assets
  (package_id, case_id, ordinal, source_asset_id, asset_type, source_updated_at,
   ciphertext, nonce, ciphertext_digest)
select package.id, package.case_id, 1, '${id.asset}', 'document_location', now() - interval '1 hour',
  repeat('V', 64), repeat('N', 24), encode(extensions.digest(concat_ws('|',
    '${id.asset}', 'document_location', repeat('V', 64), repeat('N', 24)), 'sha256'), 'hex')
from public.claimant_release_packages package;
update public.claimant_recipient_grants set
  protocol = 'sanduqkin:claim:recipient-grant:v2', profile = 'registered_recipient_v2',
  key_agreement = 'p256_ecdh', kdf = 'hkdf_sha256',
  aead = 'xchacha20poly1305_ietf', owner_ephemeral_public_key = repeat('E', 87),
  nonce = repeat('G', 32), ciphertext = repeat('C', 96);
insert into public.claimant_release_retrieval_sessions
  (id, case_id, finalization_id, package_id, claimant_user_id, portal_session_id,
   portal_session_version, grant_id, recipient_key_id, recipient_key_version,
   source_case_version, authenticated_at, authorized_at, expires_at)
select '${id.retrieval}', case_row.id, finalization.id, package.id,
  case_row.claimant_user_id, portal.active_session_id, portal.version,
  grant_row.id, grant_row.recipient_key_id, grant_row.recipient_key_version,
  case_row.version, portal.authenticated_at, now(), now() + interval '10 minutes'
from public.claimant_cases case_row
join public.claimant_release_packages package on package.case_id = case_row.id
join public.claimant_release_package_finalizations finalization
  on finalization.package_id = package.id
join public.claimant_release_signed_manifests manifest
  on manifest.finalization_id = finalization.id and manifest.ordinal = 1
join public.claimant_recipient_grants grant_row on grant_row.id = manifest.grant_id
join public.claimant_portal_session_controls portal on portal.user_id = case_row.claimant_user_id;
set local role service_role;
do $test$
declare v_case public.claimant_cases%rowtype;
  v_prepared jsonb; v_replayed jsonb; v_committed jsonb; v_completed timestamptz;
  v_receipt_digest text; v_delivery_key text := 'synthetic_package_delivery_slice_4e';
  v_receipt_ref text := 'synthetic_delivery_receipt_slice_4e';
begin
  select * into v_case from public.claimant_cases;
  begin
    update public.claimant_release_retrieval_sessions set
      authenticated_at = now() - interval '20 minutes',
      authorized_at = now() - interval '15 minutes',
      expires_at = now() - interval '1 minute' where id = '${id.retrieval}';
    begin perform public.claimant_prepare_encrypted_package_delivery('${id.delivery}',
      v_delivery_key, '${id.retrieval}', v_case.id, 7, '${id.bad}');
      raise exception 'expired retrieval session was accepted';
    exception when invalid_authorization_specification then null; end;
    raise exception 'ROLLBACK_EXPIRY' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_EXPIRY' then raise; end if; end;
  begin
    update public.claimant_recipient_grants
    set status = 'revoked'${options.standalone ? "" : ", revoked_at = now()"}
      where id = (select grant_id from public.claimant_release_retrieval_sessions
        where id = '${id.retrieval}');
    begin perform public.claimant_prepare_encrypted_package_delivery('${id.delivery}',
      v_delivery_key, '${id.retrieval}', v_case.id, 7, '${id.bad}');
      raise exception 'revoked grant was accepted';
    exception when serialization_failure then null; end;
    raise exception 'ROLLBACK_GRANT' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_GRANT' then raise; end if; end;
  begin
    ${interventionInsert}
    begin perform public.claimant_prepare_encrypted_package_delivery('${id.delivery}',
      v_delivery_key, '${id.retrieval}', v_case.id, 7, '${id.bad}');
      raise exception 'intervention was accepted';
    exception when serialization_failure then null; end;
    raise exception 'ROLLBACK_INTERVENTION' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_INTERVENTION' then raise; end if; end;
  v_prepared := public.claimant_prepare_encrypted_package_delivery('${id.delivery}',
    v_delivery_key, '${id.retrieval}', v_case.id, 7, '${id.prepare}');
  if v_prepared ->> 'delivery_status' <> 'prepared_unserved'
    or (v_prepared ->> 'package_served')::boolean
    or (v_prepared ->> 'retrieval_completed')::boolean
    or encode(extensions.digest(v_prepared ->> 'delivery_payload', 'sha256'), 'hex')
      <> v_prepared ->> 'payload_digest'
    or octet_length(v_prepared ->> 'delivery_payload') <> (v_prepared ->> 'payload_bytes')::int
    or not ((v_prepared -> 'delivery_payload')::text like '%ciphertext%')
    or lower(v_prepared ->> 'delivery_payload') ~ '(plaintext|signed_url|access_token|private_key)' then
    raise exception 'prepared delivery payload was unsafe'; end if;
  v_replayed := public.claimant_prepare_encrypted_package_delivery('${id.delivery}',
    v_delivery_key, '${id.retrieval}', v_case.id, 7, '${id.prepare}');
  if not (v_replayed ->> 'replayed')::boolean
    or v_replayed ->> 'payload_digest' <> v_prepared ->> 'payload_digest'
    or v_replayed ->> 'delivery_payload' <> v_prepared ->> 'delivery_payload' then
    raise exception 'prepare replay was unstable'; end if;
  v_completed := date_trunc('milliseconds', clock_timestamp());
  v_receipt_digest := encode(extensions.digest(concat_ws('|',
    'sanduqkin:claim:encrypted-delivery-receipt:v1', v_delivery_key,
    v_prepared ->> 'payload_digest', v_prepared ->> 'payload_bytes',
    to_char(v_completed at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    v_receipt_ref), 'sha256'), 'hex');
  begin perform public.claimant_commit_encrypted_package_delivery('${id.delivery}',
    v_delivery_key, repeat('0', 64), (v_prepared ->> 'payload_bytes')::int,
    v_completed, v_receipt_ref, v_receipt_digest, '${id.bad}');
    raise exception 'wrong payload digest was accepted';
  exception when serialization_failure then null; end;
  v_committed := public.claimant_commit_encrypted_package_delivery('${id.delivery}',
    v_delivery_key, v_prepared ->> 'payload_digest', (v_prepared ->> 'payload_bytes')::int,
    v_completed, v_receipt_ref, v_receipt_digest, '${id.commit}');
  if v_committed ->> 'case_state' <> 'released'
    or (v_committed ->> 'case_version')::int <> 8
    or not (v_committed ->> 'first_successful_delivery')::boolean
    or not (v_committed ->> 'package_served')::boolean
    or (v_committed ->> 'retrieval_completed')::boolean then
    raise exception 'commit result was unsafe'; end if;
  if not (public.claimant_commit_encrypted_package_delivery('${id.delivery}',
    v_delivery_key, v_prepared ->> 'payload_digest', (v_prepared ->> 'payload_bytes')::int,
    v_completed, v_receipt_ref, v_receipt_digest, '${id.commit}') ->> 'replayed')::boolean then
    raise exception 'commit replay was unstable'; end if;
  v_replayed := public.claimant_prepare_encrypted_package_delivery('${id.delivery}',
    v_delivery_key, '${id.retrieval}', v_case.id, 7, '${id.prepare}');
  if not (v_replayed ->> 'replayed')::boolean
    or v_replayed ->> 'payload_digest' <> v_prepared ->> 'payload_digest'
    or v_replayed ->> 'delivery_payload' <> v_prepared ->> 'delivery_payload' then
    raise exception 'post-commit preparation replay was unstable'; end if;
  if (select state from public.claimant_cases) <> 'released'
    or (select version from public.claimant_cases) <> 8
    or (select status from public.claimant_encrypted_package_deliveries) <> 'served'
    or not (select package_served from public.claimant_encrypted_package_deliveries)
    or (select retrieval_completed from public.claimant_encrypted_package_deliveries)
    or (select status from public.claimant_release_retrieval_sessions) <> 'consumed_served'
    or not (select package_served from public.claimant_release_retrieval_sessions)
    or (select retrieval_completed from public.claimant_release_retrieval_sessions)
    or (select count(*) from public.claimant_encrypted_package_delivery_events) <> 2
    or (select count(*) from public.claimant_encrypted_package_delivery_idempotency) <> 2 then
    raise exception 'atomic delivery records failed'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_encrypted_package_deliveries;
    raise exception 'authenticated role read encrypted deliveries';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_prepare_encrypted_package_delivery('${id.delivery}',
    'synthetic_package_delivery_slice_4e', '${id.retrieval}',
    (select id from public.claimant_cases), 7, '${id.bad}');
    raise exception 'authenticated role called delivery preparation';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_ENCRYPTED_PACKAGE_DELIVERY_DB_TEST_PASSED';`;
}

function runClaimantEncryptedPackageDeliveryDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildClaimantEncryptedPackageDeliveryDbTestSql(options) });
  if (!output.includes("CLAIMANT_ENCRYPTED_PACKAGE_DELIVERY_DB_TEST_PASSED"))
    throw new Error("Encrypted-package delivery DB marker was missing.");
}

if (require.main === module) {
  const standalone = process.argv.includes("--standalone");
  const containerFlag = process.argv.indexOf("--container");
  const container = containerFlag >= 0 ? process.argv[containerFlag + 1] : undefined;
  runClaimantEncryptedPackageDeliveryDbTest({ container, standalone });
  console.log("Claimant encrypted-package delivery DB test passed.");
}
module.exports = { buildClaimantEncryptedPackageDeliveryDbTestSql,
  runClaimantEncryptedPackageDeliveryDbTest };
