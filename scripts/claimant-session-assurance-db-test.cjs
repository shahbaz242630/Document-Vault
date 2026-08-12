const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const DEFAULT_CONTAINER = "supabase_db_supabase";

function runClaimantSessionAssuranceDbTest(options = {}) {
  const ids = {
    activateOne: randomUUID(),
    activateTwo: randomUUID(),
    revoke: randomUUID(),
    sessionOne: randomUUID(),
    sessionTwo: randomUUID(),
    user: randomUUID(),
  };

  const sql = `
begin;
insert into auth.users (id) values ('${ids.user}');
set local role service_role;

do $test$
declare
  v_first jsonb;
  v_replay jsonb;
  v_displaced jsonb;
  v_revoked jsonb;
  v_fresh timestamptz := date_trunc('second', now());
begin
  v_first := public.claimant_activate_session(
    '${ids.user}', '${ids.sessionOne}', v_fresh, '${ids.activateOne}'
  );
  if (v_first ->> 'displaced_previous')::boolean or (v_first ->> 'replayed')::boolean then
    raise exception 'first activation result was invalid';
  end if;

  v_replay := public.claimant_activate_session(
    '${ids.user}', '${ids.sessionOne}', v_fresh, '${ids.activateOne}'
  );
  if not (v_replay ->> 'replayed')::boolean then
    raise exception 'activation replay was not detected';
  end if;

  begin
    perform public.claimant_activate_session(
      '${ids.user}', '${ids.sessionTwo}', v_fresh, '${ids.activateOne}'
    );
    raise exception 'changed activation input reused an idempotency key';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.claimant_activate_session(
      '${ids.user}', '${ids.sessionTwo}', now() - interval '11 minutes', '${randomUUID()}'
    );
    raise exception 'stale authentication activated a session';
  exception when invalid_authorization_specification then null;
  end;

  v_displaced := public.claimant_activate_session(
    '${ids.user}', '${ids.sessionTwo}', v_fresh, '${ids.activateTwo}'
  );
  if not (v_displaced ->> 'displaced_previous')::boolean then
    raise exception 'new session did not displace the old session';
  end if;

  begin
    perform public.claimant_assert_active_session('${ids.user}', '${ids.sessionOne}');
    raise exception 'displaced session remained active';
  exception when invalid_authorization_specification then null;
  end;
  perform public.claimant_assert_active_session('${ids.user}', '${ids.sessionTwo}');

  v_revoked := public.claimant_revoke_session(
    '${ids.user}', '${ids.sessionTwo}', '${ids.revoke}'
  );
  if not (v_revoked ->> 'revoked')::boolean then
    raise exception 'session was not revoked';
  end if;

  begin
    perform public.claimant_assert_active_session('${ids.user}', '${ids.sessionTwo}');
    raise exception 'revoked session remained active';
  exception when invalid_authorization_specification then null;
  end;

  if (select count(*) from public.claimant_session_events where actor_user_id = '${ids.user}') <> 3 then
    raise exception 'session event count was not append-only and exact';
  end if;
  if (select count(*) from public.claimant_idempotency_records where actor_user_id = '${ids.user}') <> 3 then
    raise exception 'session idempotency count was not exact';
  end if;

  begin
    update public.claimant_session_events set metadata = '{}' where actor_user_id = '${ids.user}';
    raise exception 'service role updated append-only session events';
  exception when insufficient_privilege then null;
  end;
end
$test$;

rollback;
select 'CLAIMANT_SESSION_ASSURANCE_DB_TEST_PASSED';
`;

  const output = execFileSync(
    "docker",
    ["exec", "-i", options.container ?? DEFAULT_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
    { encoding: "utf8", input: sql },
  );
  if (!output.includes("CLAIMANT_SESSION_ASSURANCE_DB_TEST_PASSED")) {
    throw new Error("Claimant session assurance database test marker was missing.");
  }
}

if (require.main === module) {
  runClaimantSessionAssuranceDbTest();
  console.log("Claimant session assurance database test passed.");
}

module.exports = { runClaimantSessionAssuranceDbTest };
