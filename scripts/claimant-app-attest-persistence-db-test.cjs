const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const DEFAULT_CONTAINER = "supabase_db_supabase";

function runClaimantAppAttestPersistenceDbTest(options = {}) {
  const id = Object.fromEntries([
    "user", "session", "registration", "assertion", "replay", "claimantKey",
  ].map((name) => [name, randomUUID()]));
  const digest = "A".repeat(42) + "E";
  const appIdHash = "B".repeat(42) + "E";
  const sql = `
begin;
insert into auth.users (id) values ('${id.user}');
insert into public.claimant_identities (user_id, status) values ('${id.user}', 'active');
insert into public.claimant_portal_eligibilities (user_id, status, source) values ('${id.user}', 'eligible', 'synthetic_fixture');
insert into public.claimant_portal_session_controls (user_id, active_session_id, status, assurance_level, authenticated_at)
values ('${id.user}', '${id.session}', 'active', 'aal2', now());
insert into public.claimant_device_keys (id, claimant_user_id, device_binding_digest, public_key_jwk)
values ('${id.claimantKey}', '${id.user}', repeat('a', 64), '{"kty":"EC","crv":"P-256","x":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","y":"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"}');
set local role service_role;
do $test$
declare v_registration jsonb; v_assertion jsonb;
begin
  v_registration := public.claimant_register_app_attest_key(
    '${id.user}', '${id.session}', '${digest}', '${appIdHash}', repeat('Q', 80), encode('receipt'::bytea, 'base64'),
    'production', '1', 2, '${id.registration}'
  );
  if (v_registration ->> 'assertion_counter')::bigint <> 0 then raise exception 'registration counter was not zero'; end if;
  v_assertion := public.claimant_advance_app_attest_assertion(
    '${id.user}', '${id.session}', '${id.claimantKey}', '${digest}', 0, 7, '1', 2, '${id.assertion}'
  );
  if (v_assertion ->> 'assertion_counter')::bigint <> 7 then raise exception 'assertion counter did not advance'; end if;
  begin
    perform public.claimant_advance_app_attest_assertion(
      '${id.user}', '${id.session}', '${id.claimantKey}', '${digest}', 0, 7, '1', 2, '${id.replay}'
    );
    raise exception 'replayed counter was accepted';
  exception when serialization_failure then null;
  end;
  if (select count(*) from public.claimant_app_attest_events where claimant_user_id = '${id.user}') <> 2 then
    raise exception 'App Attest event count was not exact';
  end if;
  begin
    update public.claimant_app_attest_events set metadata = '{}' where claimant_user_id = '${id.user}';
    raise exception 'service role updated append-only App Attest events';
  exception when insufficient_privilege then null;
  end;
end
$test$;
rollback;
select 'CLAIMANT_APP_ATTEST_PERSISTENCE_DB_TEST_PASSED';
`;
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: sql });
  if (!output.includes("CLAIMANT_APP_ATTEST_PERSISTENCE_DB_TEST_PASSED")) throw new Error("App Attest DB test marker was missing.");
}

if (require.main === module) { runClaimantAppAttestPersistenceDbTest(); console.log("Claimant App Attest persistence DB test passed."); }
module.exports = { runClaimantAppAttestPersistenceDbTest };
