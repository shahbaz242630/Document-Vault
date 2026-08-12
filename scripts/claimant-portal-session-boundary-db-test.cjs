const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const DEFAULT_CONTAINER = "supabase_db_supabase";

function runClaimantPortalSessionBoundaryDbTest(options = {}) {
  const id = Object.fromEntries([
    "eligible", "ineligible", "revoked", "sessionOne", "sessionTwo",
    "activateOne", "activateTwo", "revoke",
  ].map((name) => [name, randomUUID()]));
  const sql = `
begin;
insert into auth.users (id) values ('${id.eligible}'), ('${id.ineligible}'), ('${id.revoked}');
insert into public.claimant_portal_eligibilities (user_id, status, source, revoked_at) values
  ('${id.eligible}', 'eligible', 'synthetic_fixture', null),
  ('${id.revoked}', 'revoked', 'synthetic_fixture', now());
set local role service_role;
do $test$
declare
  v_first jsonb;
  v_second jsonb;
  v_revoked jsonb;
  v_fresh timestamptz := date_trunc('second', now());
begin
  for v_first in select jsonb_build_object('user_id', value) from jsonb_array_elements_text(
    jsonb_build_array('${id.ineligible}', '${id.revoked}')
  ) loop
    begin
      perform public.claimant_activate_portal_session(
        (v_first ->> 'user_id')::uuid, '${id.sessionOne}', v_fresh, gen_random_uuid()
      );
      raise exception 'ineligible identity activated a claimant portal session';
    exception when insufficient_privilege then null;
    end;
  end loop;

  v_first := public.claimant_activate_portal_session(
    '${id.eligible}', '${id.sessionOne}', v_fresh, '${id.activateOne}'
  );
  if v_first ->> 'context' <> 'claimant_portal' or (v_first ->> 'displaced_previous')::boolean then
    raise exception 'first portal activation was invalid';
  end if;
  perform public.claimant_assert_portal_session('${id.eligible}', '${id.sessionOne}');

  v_second := public.claimant_activate_portal_session(
    '${id.eligible}', '${id.sessionTwo}', v_fresh, '${id.activateTwo}'
  );
  if not (v_second ->> 'displaced_previous')::boolean then
    raise exception 'second portal session did not displace the first';
  end if;
  begin
    perform public.claimant_assert_portal_session('${id.eligible}', '${id.sessionOne}');
    raise exception 'displaced portal session remained active';
  exception when invalid_authorization_specification then null;
  end;

  v_revoked := public.claimant_revoke_portal_session(
    '${id.eligible}', '${id.sessionTwo}', '${id.revoke}'
  );
  if not (v_revoked ->> 'revoked')::boolean then
    raise exception 'portal session revocation failed';
  end if;
  if exists (select 1 from public.claimant_session_controls where user_id = '${id.eligible}') then
    raise exception 'portal activation leaked into the Phase 1 shared session context';
  end if;
  if (select count(*) from public.claimant_portal_session_events where actor_user_id = '${id.eligible}') <> 3 then
    raise exception 'portal session event count was not exact';
  end if;
  begin
    update public.claimant_portal_session_events set metadata = '{}'
    where actor_user_id = '${id.eligible}';
    raise exception 'service role updated append-only portal session events';
  exception when insufficient_privilege then null;
  end;
end
$test$;
rollback;
select 'CLAIMANT_PORTAL_SESSION_BOUNDARY_DB_TEST_PASSED';
`;
  const output = execFileSync(
    "docker",
    ["exec", "-i", options.container ?? DEFAULT_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
    { encoding: "utf8", input: sql },
  );
  if (!output.includes("CLAIMANT_PORTAL_SESSION_BOUNDARY_DB_TEST_PASSED")) {
    throw new Error("Claimant portal session boundary database test marker was missing.");
  }
}

if (require.main === module) {
  runClaimantPortalSessionBoundaryDbTest();
  console.log("Claimant portal session boundary database test passed.");
}

module.exports = { runClaimantPortalSessionBoundaryDbTest };
