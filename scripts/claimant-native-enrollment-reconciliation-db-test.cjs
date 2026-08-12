const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const DEFAULT_CONTAINER = "supabase_db_supabase";

function runClaimantNativeEnrollmentReconciliationDbTest(options = {}) {
  const migration = readFileSync(resolve(__dirname,
    "../supabase/migrations/20260812190000_claimant_native_enrollment_reconciliation.sql"), "utf8");
  const id = Object.fromEntries(["owner", "claimant", "session", "sessionTwo", "invitation", "invitationTwo", "appOne", "nativeOne",
    "appTwo", "nativeTwo", "keyOne", "keyTwo", "attemptOne", "attemptTwo", "caseTwo"]
    .map((name) => [name, randomUUID()]));
  const digest = "A".repeat(42) + "E"; const publicKey = "BA" + "A".repeat(84) + "E";
  const sql = `
begin;
${migration}
insert into auth.users (id) values ('${id.owner}'), ('${id.claimant}');
insert into public.claimant_portal_eligibilities (user_id, status, source)
values ('${id.claimant}', 'eligible', 'synthetic_fixture');
insert into public.claimant_portal_session_controls (user_id, active_session_id, status, assurance_level, authenticated_at)
values ('${id.claimant}', '${id.session}', 'active', 'aal2', now());
insert into public.claimant_invitations (id, owner_user_id, recipient_address_digest, expires_at)
values ('${id.invitation}', '${id.owner}', repeat('a', 64), now() + interval '1 hour'),
  ('${id.invitationTwo}', '${id.owner}', repeat('b', 64), now() + interval '1 hour');

insert into public.claimant_app_attest_challenges (id, purpose, claimant_user_id, portal_session_id,
  app_attest_key_id_digest, app_id_hash, environment, required_bundle_version,
  required_validation_category, challenge_bytes_base64url, challenge_bytes_digest,
  native_enrollment_challenge_digest, issued_at, expires_at)
values
  ('${id.appOne}', 'native_enrollment_assertion', '${id.claimant}', '${id.session}', '${digest}', '${digest}',
   'production', '1', 2, repeat('A', 43), '${digest}', '${digest}', now(), now() + interval '5 minutes'),
  ('${id.appTwo}', 'native_enrollment_assertion', '${id.claimant}', '${id.session}', '${digest}', '${digest}',
   'production', '1', 2, repeat('B', 43), '${digest}', '${digest}', now(), now() + interval '5 minutes');
insert into public.claimant_native_enrollment_challenges (id, app_attest_assertion_challenge_id,
  claimant_user_id, portal_session_id, invitation_id, invitation_version, recipient_address_digest,
  eligibility_version, claimant_key_id, device_binding_digest, public_key_x963_base64url,
  public_key_fingerprint, public_key_jwk, policy_pack_id, policy_pack_version, origin,
  challenge_bytes_base64url, challenge_bytes_digest, server_ephemeral_private_key_envelope,
  app_attest_key_id_digest, issued_at, expires_at)
values
  ('${id.nativeOne}', '${id.appOne}', '${id.claimant}', '${id.session}', '${id.invitation}', 1, repeat('a',64),
   1, '${id.keyOne}', repeat('b',64), '${publicKey}', '${digest}',
   jsonb_build_object('kty','EC','crv','P-256','x',repeat('A',43),'y',repeat('B',43)), 'test-v1', 1,
   'https://api.test', repeat('C',43), '${digest}', repeat('x',80), '${digest}', now(), now() + interval '5 minutes'),
  ('${id.nativeTwo}', '${id.appTwo}', '${id.claimant}', '${id.session}', '${id.invitationTwo}', 1, repeat('b',64),
   1, '${id.keyTwo}', repeat('c',64), '${publicKey}', '${digest}',
   jsonb_build_object('kty','EC','crv','P-256','x',repeat('C',43),'y',repeat('D',43)), 'test-v1', 1,
   'https://api.test', repeat('D',43), '${digest}', repeat('y',80), '${digest}', now(), now() + interval '5 minutes');

set local role service_role;
do $test$
declare v_result jsonb;
begin
  v_result := public.claimant_reconcile_native_enrollment('${id.claimant}', '${id.session}',
    '${id.attemptOne}', '${id.nativeOne}', '${id.appOne}');
  if v_result ->> 'status' <> 'not_committed' then raise exception 'uncommitted attempt was not terminally reconciled'; end if;
  if (select status from public.claimant_native_enrollment_challenges where id = '${id.nativeOne}') <> 'expired'
    or (select status from public.claimant_app_attest_challenges where id = '${id.appOne}') <> 'expired' then
    raise exception 'uncommitted challenge tuple was not invalidated';
  end if;
  v_result := public.claimant_reconcile_native_enrollment('${id.claimant}', '${id.session}',
    '${id.attemptOne}', '${id.nativeOne}', '${id.appOne}');
  if v_result ->> 'status' <> 'not_committed' then raise exception 'terminal reconciliation was not stable'; end if;
end
$test$;
reset role;

update public.claimant_portal_session_controls set active_session_id = '${id.sessionTwo}', authenticated_at = now(),
  activated_at = now(), updated_at = now() where user_id = '${id.claimant}';

update public.claimant_app_attest_challenges set status = 'consumed', consumed_at = now() where id = '${id.appTwo}';
update public.claimant_native_enrollment_challenges set status = 'consumed', consumed_at = now() where id = '${id.nativeTwo}';
insert into public.claimant_idempotency_records (operation, actor_user_id, idempotency_key, request_digest, result)
values ('accept_native_enrollment', '${id.claimant}', '${id.attemptTwo}', repeat('d',64), jsonb_build_object(
  'assertion_counter', 1, 'case_id', '${id.caseTwo}', 'case_version', 1,
  'claimant_key_id', '${id.keyTwo}', 'invitation_id', '${id.invitationTwo}', 'invitation_version', 2));
set local role service_role;
do $test$
declare v_result jsonb;
begin
  v_result := public.claimant_reconcile_native_enrollment('${id.claimant}', '${id.sessionTwo}',
    '${id.attemptTwo}', '${id.nativeTwo}', '${id.appTwo}');
  if v_result ->> 'status' <> 'committed' or not (v_result #>> '{result,replayed}')::boolean then
    raise exception 'committed result was not authoritatively replayed';
  end if;
  v_result := public.claimant_reconcile_native_enrollment('${id.claimant}', '${id.sessionTwo}',
    '${id.attemptTwo}', '${id.nativeTwo}', '${id.appOne}');
  if v_result ->> 'status' <> 'unknown' then raise exception 'cross-challenge reconciliation did not fail closed'; end if;
end
$test$;
reset role;
set local role authenticated;
do $test$ begin
  begin
    perform public.claimant_reconcile_native_enrollment('${id.claimant}', '${id.sessionTwo}',
      '${id.attemptTwo}', '${id.nativeTwo}', '${id.appTwo}');
    raise exception 'authenticated reconciliation unexpectedly executed';
  exception when insufficient_privilege then null; end;
end $test$;
rollback;
select 'CLAIMANT_NATIVE_ENROLLMENT_RECONCILIATION_DB_TEST_PASSED';
`;
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: sql });
  if (!output.includes("CLAIMANT_NATIVE_ENROLLMENT_RECONCILIATION_DB_TEST_PASSED")) {
    throw new Error("Native enrollment reconciliation DB test marker was missing.");
  }
}

if (require.main === module) {
  runClaimantNativeEnrollmentReconciliationDbTest();
  console.log("Claimant native enrollment reconciliation DB test passed.");
}
module.exports = { runClaimantNativeEnrollmentReconciliationDbTest };
