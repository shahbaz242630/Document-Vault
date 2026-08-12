const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CONTAINER = "supabase_db_supabase";

function runClaimantNativeEnrollmentDbTest(options = {}) {
  const vector = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    "../packages/shared-types/test-vectors/claim/native-enrollment-proof-v1.json"), "utf8"));
  const point = Buffer.from(vector.challenge_request.public_key, "base64url");
  const publicJwk = JSON.stringify({ kty: "EC", crv: "P-256",
    x: point.subarray(1, 33).toString("base64url"), y: point.subarray(33).toString("base64url") });
  const id = Object.fromEntries(["owner", "claimant", "session", "invitation", "invitationTwo",
    "registrationChallenge", "registrationIssue", "registrationBad", "registrationConsume",
    "nativeChallenge", "assertionChallenge", "nativeIssue", "nativeAccept", "nativeReplay",
    "nativeChallengeTwo", "assertionChallengeTwo", "nativeIssueTwo", "nativeBad",
    "claimantKey", "claimantKeyTwo"].map((name) => [name, randomUUID()]));
  const keyDigest = "A".repeat(42) + "E"; const appIdHash = "B".repeat(42) + "E";
  const registrationDigest = "C".repeat(42) + "E"; const nativeDigest = "D".repeat(42) + "E";
  const assertionDigest = "F".repeat(42) + "E"; const addressDigest = "c".repeat(64);
  const sql = `
begin;
insert into auth.users (id) values ('${id.owner}'), ('${id.claimant}');
insert into public.claimant_portal_eligibilities (user_id, status, source)
values ('${id.claimant}', 'eligible', 'synthetic_fixture');
insert into public.claimant_portal_session_controls (user_id, active_session_id, status, assurance_level, authenticated_at)
values ('${id.claimant}', '${id.session}', 'active', 'aal2', now());
insert into public.claimant_invitations (id, owner_user_id, recipient_address_digest, expires_at)
values ('${id.invitation}', '${id.owner}', '${addressDigest}', now() + interval '1 hour'),
  ('${id.invitationTwo}', '${id.owner}', repeat('e', 64), now() + interval '1 hour');
set local role service_role;
do $test$
declare v_now timestamptz := date_trunc('second', now()); v_result jsonb;
begin
  perform public.claimant_issue_app_attest_registration_challenge(
    '${id.claimant}', '${id.session}', '${id.registrationChallenge}', '${keyDigest}', '${appIdHash}',
    'production', '1', 2, repeat('Q', 32), '${registrationDigest}', v_now, v_now + interval '5 minutes',
    '${id.registrationIssue}'
  );
  begin
    perform public.claimant_consume_app_attest_registration_challenge(
      '${id.claimant}', '${id.session}', '${id.registrationChallenge}', '${assertionDigest}',
      '${keyDigest}', repeat('Q', 80), encode('receipt'::bytea, 'base64'), '1', 2, '${id.registrationBad}'
    );
    raise exception 'changed registration digest was accepted';
  exception when serialization_failure then null;
  end;
  if (select status from public.claimant_app_attest_challenges where id = '${id.registrationChallenge}') <> 'issued'
    then raise exception 'failed registration consumed its challenge'; end if;
  perform public.claimant_consume_app_attest_registration_challenge(
    '${id.claimant}', '${id.session}', '${id.registrationChallenge}', '${registrationDigest}',
    '${keyDigest}', repeat('Q', 80), encode('receipt'::bytea, 'base64'), '1', 2, '${id.registrationConsume}'
  );
  if (select status from public.claimant_app_attest_challenges where id = '${id.registrationChallenge}') <> 'consumed'
    then raise exception 'registration challenge was not consumed'; end if;

  perform public.claimant_issue_native_enrollment_challenge(
    '${id.claimant}', '${id.session}', '${id.nativeChallenge}', '${id.assertionChallenge}',
    '${id.invitation}', 1, '${addressDigest}', 1, '${id.claimantKey}', repeat('d', 64),
    '${vector.challenge_request.public_key}', '${vector.challenge.public_key_fingerprint}',
    '${publicJwk}'::jsonb, 'death-only-v1', 1, 'https://api.sanduqkin.test', repeat('R', 32),
    '${nativeDigest}', repeat('S', 80), '${keyDigest}', repeat('T', 32), '${assertionDigest}',
    '${appIdHash}', 'production', '1', 2, v_now, v_now + interval '5 minutes', '${id.nativeIssue}'
  );
  v_result := public.claimant_accept_native_enrollment(
    '${id.claimant}', '${id.session}', '${id.nativeChallenge}', '${id.assertionChallenge}',
    '${nativeDigest}', '${assertionDigest}', 0, 1, '1', 2, '${id.nativeAccept}'
  );
  if v_result ->> 'claimant_key_id' <> '${id.claimantKey}' or (v_result ->> 'assertion_counter')::bigint <> 1
    then raise exception 'native acceptance result was not bound'; end if;
  if (select status from public.claimant_invitations where id = '${id.invitation}') <> 'accepted'
    then raise exception 'invitation was not accepted'; end if;
  if (select assertion_counter from public.claimant_app_attest_keys where app_attest_key_id_digest = '${keyDigest}') <> 1
    then raise exception 'App Attest counter did not advance'; end if;
  if (select status from public.claimant_native_enrollment_challenges where id = '${id.nativeChallenge}') <> 'consumed'
    then raise exception 'native challenge was not consumed'; end if;
  v_result := public.claimant_accept_native_enrollment(
    '${id.claimant}', '${id.session}', '${id.nativeChallenge}', '${id.assertionChallenge}',
    '${nativeDigest}', '${assertionDigest}', 0, 1, '1', 2, '${id.nativeAccept}'
  );
  if not (v_result ->> 'replayed')::boolean then raise exception 'idempotent replay was not identified'; end if;
  begin
    perform public.claimant_accept_native_enrollment(
      '${id.claimant}', '${id.session}', '${id.nativeChallenge}', '${id.assertionChallenge}',
      '${nativeDigest}', '${assertionDigest}', 0, 1, '1', 2, '${id.nativeReplay}'
    );
    raise exception 'consumed challenges were reused';
  exception when serialization_failure then null;
  end;
  if (select count(*) from public.claimant_device_keys where id = '${id.claimantKey}') <> 1
    or (select count(*) from public.claimant_cases where invitation_id = '${id.invitation}') <> 1
    then raise exception 'native acceptance was not exactly once'; end if;

  perform public.claimant_issue_native_enrollment_challenge(
    '${id.claimant}', '${id.session}', '${id.nativeChallengeTwo}', '${id.assertionChallengeTwo}',
    '${id.invitationTwo}', 1, repeat('e', 64), 1, '${id.claimantKeyTwo}', repeat('f', 64),
    '${vector.challenge_request.public_key}', '${vector.challenge.public_key_fingerprint}',
    '${publicJwk}'::jsonb, 'death-only-v1', 1, 'https://api.sanduqkin.test', repeat('U', 32),
    '${registrationDigest}', repeat('V', 80), '${keyDigest}', repeat('W', 32), '${assertionDigest}',
    '${appIdHash}', 'production', '1', 2, v_now, v_now + interval '5 minutes', '${id.nativeIssueTwo}'
  );
  begin
    perform public.claimant_accept_native_enrollment(
      '${id.claimant}', '${id.session}', '${id.nativeChallengeTwo}', '${id.assertionChallengeTwo}',
      '${registrationDigest}', '${nativeDigest}', 1, 2, '1', 2, '${id.nativeBad}'
    );
    raise exception 'changed assertion digest was accepted';
  exception when serialization_failure then null;
  end;
  if (select status from public.claimant_invitations where id = '${id.invitationTwo}') <> 'pending'
    or (select status from public.claimant_native_enrollment_challenges where id = '${id.nativeChallengeTwo}') <> 'issued'
    or (select assertion_counter from public.claimant_app_attest_keys where app_attest_key_id_digest = '${keyDigest}') <> 1
    then raise exception 'failed native acceptance was not atomic'; end if;
end
$test$;
rollback;
select 'CLAIMANT_NATIVE_ENROLLMENT_DB_TEST_PASSED';
`;
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: sql });
  if (!output.includes("CLAIMANT_NATIVE_ENROLLMENT_DB_TEST_PASSED")) throw new Error("Native enrollment DB test marker was missing.");
}

if (require.main === module) { runClaimantNativeEnrollmentDbTest(); console.log("Claimant native enrollment DB test passed."); }
module.exports = { runClaimantNativeEnrollmentDbTest };
