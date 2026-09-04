const { execFile, execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const digest = (character) => `${character.repeat(42)}Q`;

function fixtureIds() {
  return Object.fromEntries([
    "owner", "claimant", "other", "session", "otherSession", "locator", "challenge",
    "grant", "case", "otherCase", "key", "otherKey",
  ].map((name) => [name, randomUUID()]));
}

function buildOfflineCodeV2CaseBindingDbTestSql(options = {}) {
  const id = options.id ?? fixtureIds();
  const argumentsSql = [`'${id.case}'`, `'${id.claimant}'`, `'${id.session}'`,
    `'${id.challenge}'`, `'${digest("B")}'`, "'synthetic_policy_death_alpha'", "1", `'${id.key}'`];
  const call = `perform public.claimant_bind_offline_code_v2_case(${argumentsSql.join(",")});`;
  const nullChecks = argumentsSql.map((_, index) => `begin
    perform public.claimant_bind_offline_code_v2_case(${argumentsSql.map((value, position) =>
      position === index ? "null" : value).join(",")});
    raise exception 'null input ${index} was accepted';
  exception when sqlstate '22023' then null; end;`).join("\n");
  const hostileChecks = [
    ["stale proof", `update public.claimant_offline_code_v2_challenges
      set terminal_at = now() - interval '6 minutes' where id = '${id.challenge}';`],
    ["expired locator", `update public.claimant_offline_code_v2_locators
      set issued_at = now() - interval '2 days', expires_at = now() - interval '1 day'
      where id = '${id.locator}';`],
    ["owner self-binding", `update public.claimant_offline_code_v2_locators
      set owner_user_id = '${id.claimant}' where id = '${id.locator}';`],
    ["mismatched commitment", `update public.claimant_offline_code_v2_challenges
      set locator_commitment = '${digest("X")}' where id = '${id.challenge}';`],
    ["locked locator", `update public.claimant_offline_code_v2_locators
      set failed_attempt_count = 5, failure_window_started_at = now(),
      locked_until = now() + interval '15 minutes' where id = '${id.locator}';`],
  ].map(([label, setup]) => `begin
    ${setup}
    begin ${call} raise exception '${label} was accepted';
    exception when sqlstate '42501' then null; end;
    raise exception 'ROLLBACK_HOSTILE';
  exception when raise_exception then
    if sqlerrm <> 'ROLLBACK_HOSTILE' then raise; end if;
  end;`).join("\n");
  const nullRouteChecks = ["locator_version", "proof_key_version", "record_binding_digest",
    "portal_session_version"].map((column) => `begin
    update public.claimant_cases set offline_code_v2_${column} = null where id = '${id.case}';
    raise exception 'null route ${column} was accepted';
  exception when check_violation then null; end;`).join("\n");
  const sql = `begin;
insert into auth.users(id) values ('${id.owner}'), ('${id.claimant}'), ('${id.other}');
insert into public.claimant_portal_eligibilities(user_id, status, source)
values ('${id.claimant}', 'eligible', 'synthetic_fixture'),
  ('${id.other}', 'eligible', 'synthetic_fixture');
insert into public.claimant_portal_session_controls(user_id, active_session_id, status,
  assurance_level, authenticated_at)
values ('${id.claimant}', '${id.session}', 'active', 'aal2', now()),
  ('${id.other}', '${id.otherSession}', 'active', 'aal2', now());
insert into public.claimant_offline_code_v2_locators(id, owner_user_id, locator_index_digest,
  locator_commitment, grant_id, proof_public_key, record_binding_digest, wrap_nonce,
  wrap_ciphertext, wrap_associated_data_digest, issued_at, expires_at)
values ('${id.locator}', '${id.owner}', '${digest("L")}', '${digest("C")}', '${id.grant}',
  '${digest("P")}', '${digest("B")}', '${"N".repeat(32)}', '${"W".repeat(64)}',
  '${digest("A")}', now(), now() + interval '30 days');
insert into public.claimant_offline_code_v2_challenges(id, locator_record_id, locator_version,
  locator_commitment, proof_key_version, proof_public_key, record_binding_digest,
  challenge_bytes_base64url, challenge_bytes_digest, origin, nonce, status,
  issued_at, expires_at, terminal_at)
values ('${id.challenge}', '${id.locator}', 2, '${digest("C")}', 1, '${digest("P")}',
  '${digest("B")}', '${"Q".repeat(80)}', '${digest("D")}',
  'https://claim.synthetic.test', '${digest("N")}', 'verified', now(),
  now() + interval '5 minutes', now());
set local role service_role;
do $test$
declare v_result jsonb; v_case public.claimant_cases%rowtype;
begin
  ${nullChecks}
  ${hostileChecks}
  update public.claimant_portal_session_controls set active_session_id = '${randomUUID()}'
  where user_id = '${id.claimant}';
  begin
    perform public.claimant_bind_offline_code_v2_case('${id.case}', '${id.claimant}',
      '${id.session}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${id.key}');
    raise exception 'displaced portal session was accepted';
  exception when sqlstate '28000' then null; end;
  update public.claimant_portal_session_controls set active_session_id = '${id.session}'
  where user_id = '${id.claimant}';
  update public.claimant_offline_code_v2_challenges set status = 'failed'
  where id = '${id.challenge}';
  begin
    perform public.claimant_bind_offline_code_v2_case('${id.case}', '${id.claimant}',
      '${id.session}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${id.key}');
    raise exception 'non-verified challenge was accepted';
  exception when sqlstate '42501' then null; end;
  update public.claimant_offline_code_v2_challenges set status = 'verified'
  where id = '${id.challenge}';
  update public.claimant_offline_code_v2_locators set status = 'revoked', revoked_at = now(),
    terminal_reason = 'owner_revoked' where id = '${id.locator}';
  begin
    perform public.claimant_bind_offline_code_v2_case('${id.case}', '${id.claimant}',
      '${id.session}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${id.key}');
    raise exception 'revoked locator was accepted';
  exception when sqlstate '42501' then null; end;
  update public.claimant_offline_code_v2_locators set status = 'active', revoked_at = null,
    terminal_reason = null where id = '${id.locator}';
  v_result := public.claimant_bind_offline_code_v2_case('${id.case}', '${id.claimant}',
    '${id.session}', '${id.challenge}', '${digest("B")}',
    'synthetic_policy_death_alpha', 1, '${id.key}');
  if v_result ->> 'route_profile' <> 'offline_code_v2'
    or v_result ->> 'authority' <> 'route_possession_only'
    or not (v_result ->> 'claimant_session_bound')::boolean
    or not (v_result ->> 'case_created')::boolean
    or (v_result ->> 'identity_verified')::boolean
    or (v_result ->> 'relationship_verified')::boolean
    or (v_result ->> 'intake_started')::boolean
    or (v_result ->> 'review_started')::boolean
    or (v_result ->> 'release_authorized')::boolean then
    raise exception 'case binding result exceeded possession authority';
  end if;
  select * into v_case from public.claimant_cases where id = '${id.case}';
  ${nullRouteChecks}
  if v_case.state <> 'draft' or v_case.version <> 1
    or v_case.claimant_user_id <> '${id.claimant}'
    or v_case.owner_user_id <> '${id.owner}'
    or v_case.invitation_id is not null or v_case.current_key_id is not null
    or v_case.offline_code_v2_locator_record_id <> '${id.locator}'
    or v_case.offline_code_v2_challenge_id <> '${id.challenge}'
    or v_case.offline_code_v2_portal_session_id <> '${id.session}' then
    raise exception 'case binding persistence was incoherent';
  end if;
  if not (public.claimant_bind_offline_code_v2_case('${id.case}', '${id.claimant}',
      '${id.session}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${id.key}') ->> 'replayed')::boolean then
    raise exception 'case binding replay was unstable';
  end if;
  begin
    perform public.claimant_bind_offline_code_v2_case('${randomUUID()}', '${id.claimant}',
      '${id.session}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${id.key}');
    raise exception 'changed idempotency input was accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.claimant_bind_offline_code_v2_case('${id.otherCase}', '${id.other}',
      '${id.otherSession}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${id.otherKey}');
    raise exception 'verified challenge rebound to another account';
  exception when sqlstate '40001' then null; end;
  update public.claimant_portal_session_controls
  set authenticated_at = now() - interval '11 minutes' where user_id = '${id.claimant}';
  begin
    perform public.claimant_bind_offline_code_v2_case('${randomUUID()}', '${id.claimant}',
      '${id.session}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${randomUUID()}');
    raise exception 'stale portal session was accepted';
  exception when sqlstate '28000' then null; end;
  if (select count(*) from public.claimant_cases where route_profile = 'offline_code_v2') <> 1
    or (select count(*) from public.claimant_audit_events
      where event_type = 'offline_code_v2_case_bound') <> 1
    or (select count(*) from public.claimant_offline_code_v2_events
      where event_type = 'case_bound') <> 1 then
    raise exception 'case binding facts were not exactly once';
  end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_cases where id = '${id.case}';
    raise exception 'authenticated role read offline-code case';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_bind_offline_code_v2_case('${randomUUID()}', '${id.claimant}',
    '${id.session}', '${id.challenge}', '${digest("B")}',
    'synthetic_policy_death_alpha', 1, '${randomUUID()}');
    raise exception 'authenticated role called case binding RPC';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
set local role anon;
do $anon$ begin
  begin perform 1 from public.claimant_cases;
    raise exception 'anonymous role read offline-code case';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_bind_offline_code_v2_case('${randomUUID()}', '${id.claimant}',
    '${id.session}', '${id.challenge}', '${digest("B")}',
    'synthetic_policy_death_alpha', 1, '${randomUUID()}');
    raise exception 'anonymous role called case binding RPC';
  exception when insufficient_privilege then null; end;
end $anon$;
reset role;
rollback;
select 'CLAIMANT_OFFLINE_CODE_V2_CASE_BINDING_DB_TEST_PASSED';`;
  return options.fixtureOnly
    ? sql.slice(0, sql.indexOf("set local role service_role;")) + "commit;"
    : sql;
}

async function runConcurrentBindingTest(container) {
  const id = fixtureIds();
  const args = ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-tA"];
  const sync = (input) => execFileSync("docker", args, { encoding: "utf8", input });
  const execute = (input, onData = () => {}) => new Promise((resolve, reject) => {
    const child = execFile("docker", args, { encoding: "utf8", timeout: 15000 },
      (error, stdout) => error ? reject(error) : resolve(stdout));
    child.stdout.on("data", onData);
    child.stdin.end(input);
  });
  sync(buildOfflineCodeV2CaseBindingDbTestSql({ id, fixtureOnly: true }));
  try {
    let signalReady;
    const ready = new Promise((resolve) => { signalReady = resolve; });
    const first = execute(`begin; set local role service_role;
      select pg_advisory_xact_lock(hashtextextended('claimant:offline-v2:record:${id.locator}',0));
      select 'LOCK_READY'; select pg_sleep(1);
      select public.claimant_bind_offline_code_v2_case('${id.case}','${id.claimant}',
        '${id.session}','${id.challenge}','${digest("B")}','synthetic_policy_death_alpha',1,'${id.key}');
      commit;`, (data) => { if (data.includes("LOCK_READY")) signalReady(); });
    await Promise.race([ready, first.then(() => { throw new Error("Missing lock marker"); })]);
    const second = execute(`begin; set local role service_role;
      do $race$ begin
        perform public.claimant_bind_offline_code_v2_case('${id.otherCase}','${id.other}',
          '${id.otherSession}','${id.challenge}','${digest("B")}',
          'synthetic_policy_death_alpha',1,'${id.otherKey}');
        raise exception 'concurrent second claimant was accepted';
      exception when serialization_failure then null; end $race$; commit;`);
    const results = await Promise.allSettled([first, second]);
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
    }
    assert.equal(sync(`select count(*) from public.claimant_cases
      where offline_code_v2_locator_record_id = '${id.locator}';`).trim(), "1");
    assert.equal(sync(`select count(*) from public.claimant_audit_events
      where case_id = '${id.case}';`).trim(), "1");
  } finally {
    sync(`begin;
      delete from public.claimant_audit_events where case_id in ('${id.case}','${id.otherCase}');
      delete from public.claimant_idempotency_records where actor_user_id in ('${id.claimant}','${id.other}');
      delete from public.claimant_cases where id in ('${id.case}','${id.otherCase}');
      delete from public.claimant_identities where user_id in ('${id.claimant}','${id.other}');
      delete from public.claimant_offline_code_v2_events where locator_record_id = '${id.locator}';
      delete from public.claimant_offline_code_v2_challenges where id = '${id.challenge}';
      delete from public.claimant_offline_code_v2_locators where id = '${id.locator}';
      delete from public.claimant_portal_session_controls where user_id in ('${id.claimant}','${id.other}');
      delete from public.claimant_portal_eligibilities where user_id in ('${id.claimant}','${id.other}');
      delete from auth.users where id in ('${id.claimant}','${id.other}','${id.owner}');
      commit;`);
  }
}

async function runOfflineCodeV2CaseBindingDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildOfflineCodeV2CaseBindingDbTestSql() });
  if (!output.includes("CLAIMANT_OFFLINE_CODE_V2_CASE_BINDING_DB_TEST_PASSED"))
    throw new Error("Offline-code V2 case binding DB marker was missing.");
  await runConcurrentBindingTest(options.container ?? DEFAULT_CONTAINER);
}

if (require.main === module) {
  const flag = process.argv.indexOf("--container");
  runOfflineCodeV2CaseBindingDbTest({
    container: flag >= 0 ? process.argv[flag + 1] : undefined,
  }).then(() => console.log("Claimant offline-code V2 case binding DB test passed."))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}

module.exports = { buildOfflineCodeV2CaseBindingDbTestSql,
  runOfflineCodeV2CaseBindingDbTest };
