const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const DEFAULT_CONTAINER = "supabase_db_supabase";

function runClaimantNativeEnrollmentControllerDbTest(options = {}) {
  const id = Object.fromEntries(["owner", "claimant", "session", "invitation", "appKey"]
    .map((name) => [name, randomUUID()]));
  const address = "a".repeat(64); const appDigest = "A".repeat(42) + "E";
  const appIdHash = "B".repeat(42) + "E";
  const sql = `
begin;
insert into auth.users (id) values ('${id.owner}'), ('${id.claimant}');
insert into public.claimant_portal_eligibilities (user_id, status, source)
values ('${id.claimant}', 'eligible', 'synthetic_fixture');
insert into public.claimant_portal_session_controls (user_id, active_session_id, status, assurance_level, authenticated_at)
values ('${id.claimant}', '${id.session}', 'active', 'aal2', now());
insert into public.claimant_invitations (id, owner_user_id, recipient_address_digest, expires_at)
values ('${id.invitation}', '${id.owner}', '${address}', now() + interval '1 hour');
insert into public.claimant_identities (user_id, status) values ('${id.claimant}', 'active');
insert into public.claimant_app_attest_keys (id, claimant_user_id, app_attest_key_id_digest, app_id_hash,
  public_key_spki_base64, attestation_receipt, environment, attested_bundle_version, attested_validation_category)
values ('${id.appKey}', '${id.claimant}', '${appDigest}', '${appIdHash}', repeat('Q', 80), 'receipt'::bytea,
  'production', '1', 2);
set local role service_role;
do $test$
declare v_authority jsonb; v_rate jsonb; i integer;
begin
  v_authority := public.claimant_get_native_enrollment_authority(
    '${id.claimant}', '${id.session}', '${id.invitation}', '${address}', '${appDigest}'
  );
  if (v_authority ->> 'invitation_id')::uuid <> '${id.invitation}'
    or (v_authority ->> 'eligibility_version')::integer <> 1 then
    raise exception 'native authority snapshot was invalid';
  end if;
  begin
    perform public.claimant_get_native_enrollment_authority(
      '${id.claimant}', '${id.session}', '${id.invitation}', repeat('b', 64), '${appDigest}'
    );
    raise exception 'changed address received authority';
  exception when insufficient_privilege then null;
  end;
  for i in 1..5 loop
    v_rate := public.claimant_take_native_enrollment_rate_limit('${id.claimant}', '${id.session}', 'native_issue');
    if not (v_rate ->> 'allowed')::boolean then raise exception 'allowed rate request failed'; end if;
  end loop;
  begin
    perform public.claimant_take_native_enrollment_rate_limit('${id.claimant}', '${id.session}', 'native_issue');
    raise exception 'rate limit was not enforced';
  exception when raise_exception then
    if sqlerrm <> 'Native enrollment request limit exceeded.' then raise; end if;
  end;
end
$test$;
rollback;
select 'CLAIMANT_NATIVE_ENROLLMENT_CONTROLLER_DB_TEST_PASSED';
`;
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: sql });
  if (!output.includes("CLAIMANT_NATIVE_ENROLLMENT_CONTROLLER_DB_TEST_PASSED")) throw new Error("Native enrollment controller DB test marker was missing.");
}

if (require.main === module) { runClaimantNativeEnrollmentControllerDbTest(); console.log("Claimant native enrollment controller DB test passed."); }
module.exports = { runClaimantNativeEnrollmentControllerDbTest };
