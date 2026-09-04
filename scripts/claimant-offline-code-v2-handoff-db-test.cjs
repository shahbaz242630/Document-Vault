const { execFile, execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const { buildOfflineCodeV2CaseBindingDbTestSql } =
  require("./claimant-offline-code-v2-case-binding-db-test.cjs");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const digest = (character) => `${character.repeat(42)}Q`;

function buildOfflineCodeV2HandoffDbTestSql() {
  const id = Object.fromEntries(["owner", "claimant", "other", "session", "otherSession", "locator",
    "challenge", "grant", "case", "otherCase", "key", "otherKey"].map((name) => [name, randomUUID()]));
  const handoff = randomUUID(); const issueKey = randomUUID(); const consumeKey = randomUUID();
  const fixture = buildOfflineCodeV2CaseBindingDbTestSql({ id, fixtureOnly: true })
    .replace(/commit;\s*$/u, "");
  return `${fixture}
set local role service_role;
do $test$
declare v_evidence jsonb; v_loaded jsonb; v_result jsonb; v_handoff uuid;
begin
  v_evidence := public.claimant_offline_code_v2_handoff('issue', '${id.claimant}', '${id.session}',
    '${id.challenge}', '${issueKey}', null, null);
  v_handoff := (v_evidence ->> 'handoff_id')::uuid;
  if v_evidence ->> 'authority' <> 'route_possession_only'
    or (v_evidence ->> 'identity_verified')::boolean
    or (v_evidence ->> 'claim_created')::boolean
    or (v_evidence ->> 'release_authorized')::boolean
    or (v_evidence ->> 'claimant_user_id')::uuid <> '${id.claimant}'
    or (v_evidence ->> 'portal_session_id')::uuid <> '${id.session}'
    or (v_evidence ->> 'source_challenge_id')::uuid <> '${id.challenge}' then
    raise exception 'issued handoff exceeded or changed authority';
  end if;
  if (public.claimant_offline_code_v2_handoff('issue', '${id.claimant}', '${id.session}',
      '${id.challenge}', '${issueKey}', null, null) ->> 'handoff_id')::uuid <> v_handoff then
    raise exception 'issue replay was unstable';
  end if;
  begin
    perform public.claimant_offline_code_v2_handoff('issue', '${id.claimant}', '${id.session}',
      '${id.challenge}', '${randomUUID()}', '${digest("T")}', null);
    raise exception 'issue accepted proof material';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.claimant_offline_code_v2_handoff('load', '${id.other}', '${id.otherSession}',
      v_handoff, '${consumeKey}', null, null);
    raise exception 'cross-account load was accepted';
  exception when sqlstate '42501' then null; end;
  v_loaded := public.claimant_offline_code_v2_handoff('load', '${id.claimant}', '${id.session}',
    v_handoff, '${consumeKey}', null, null);
  if v_loaded ->> 'transcript_digest' <> v_evidence ->> 'transcript_digest'
    or v_loaded ->> 'transcript_bytes_base64url' <> v_evidence ->> 'transcript_bytes_base64url' then
    raise exception 'stored transcript changed';
  end if;
  begin
    perform public.claimant_offline_code_v2_handoff('consume', '${id.claimant}', '${id.session}',
      v_handoff, '${consumeKey}', '${digest("X")}', '${digest("S")}');
    raise exception 'changed transcript digest was accepted';
  exception when sqlstate '42501' then null; end;
  v_result := public.claimant_offline_code_v2_handoff('consume', '${id.claimant}', '${id.session}',
    v_handoff, '${consumeKey}', v_evidence ->> 'transcript_digest', '${digest("S")}');
  if v_result ->> 'state' <> 'draft' or v_result ->> 'authority' <> 'route_possession_only'
    or not (v_result ->> 'case_created')::boolean or (v_result ->> 'identity_verified')::boolean
    or (v_result ->> 'intake_started')::boolean or (v_result ->> 'review_started')::boolean
    or (v_result ->> 'release_authorized')::boolean then
    raise exception 'consume exceeded draft possession authority';
  end if;
  if not (public.claimant_offline_code_v2_handoff('consume', '${id.claimant}', '${id.session}',
      v_handoff, '${consumeKey}', v_evidence ->> 'transcript_digest', '${digest("S")}'
      ) ->> 'replayed')::boolean then raise exception 'consume replay was unstable'; end if;
  begin
    perform public.claimant_offline_code_v2_handoff('consume', '${id.claimant}', '${id.session}',
      v_handoff, '${randomUUID()}', v_evidence ->> 'transcript_digest', '${digest("Z")}');
    raise exception 'changed completion replay was accepted';
  exception when sqlstate '22023' then null; end;
  if (select count(*) from public.claimant_cases where id = (v_evidence ->> 'case_id')::uuid) <> 1
    or (select count(*) from public.claimant_offline_code_v2_handoffs where id = v_handoff
      and consumed_at is not null) <> 1 then raise exception 'handoff was not exactly once'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_offline_code_v2_handoffs;
    raise exception 'authenticated role read handoff';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_offline_code_v2_handoff('load', '${id.claimant}', '${id.session}',
    '${handoff}', '${randomUUID()}', null, null);
    raise exception 'authenticated role called handoff RPC';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
set local role anon;
do $denied$ begin
  begin perform 1 from public.claimant_offline_code_v2_handoffs;
    raise exception 'anonymous role read handoff';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_OFFLINE_CODE_V2_HANDOFF_DB_TEST_PASSED';`;
}

async function runOfflineCodeV2HandoffDbTest(options = {}) {
  const selectedContainer = options.container ?? DEFAULT_CONTAINER;
  const output = execFileSync("docker", ["exec", "-i", selectedContainer,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildOfflineCodeV2HandoffDbTestSql() });
  if (!output.includes("CLAIMANT_OFFLINE_CODE_V2_HANDOFF_DB_TEST_PASSED"))
    throw new Error("Offline-code V2 handoff DB marker was missing.");
  await runConcurrentHandoffTest(selectedContainer);
}

async function runConcurrentHandoffTest(selectedContainer) {
  const id = Object.fromEntries(["owner", "claimant", "other", "session", "otherSession", "locator",
    "challenge", "grant", "case", "otherCase", "key", "otherKey"].map((name) => [name, randomUUID()]));
  const args = ["exec", "-i", selectedContainer, "psql", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-qtA"];
  const sync = (input) => execFileSync("docker", args, { encoding: "utf8", input }).trim();
  const execute = (input, onData = () => {}) => new Promise((resolve, reject) => {
    const child = execFile("docker", args, { encoding: "utf8", timeout: 15000 },
      (error, stdout) => error ? reject(error) : resolve(stdout));
    child.stdout.on("data", onData); child.stdin.end(input);
  });
  sync(buildOfflineCodeV2CaseBindingDbTestSql({ id, fixtureOnly: true }));
  try {
    const issued = sync(`set role service_role; select (e->>'handoff_id') || '|' ||
      (e->>'transcript_digest') from (select public.claimant_offline_code_v2_handoff('issue',
      '${id.claimant}','${id.session}','${id.challenge}','${randomUUID()}',null,null) e) x; reset role;`)
      .split(/\r?\n/u).find((line) => line.includes("|"));
    if (!issued) throw new Error("Concurrent handoff fixture was not issued.");
    const [handoff, transcript] = issued.split("|");
    const completionKey = randomUUID();
    let signalReady; const ready = new Promise((resolve) => { signalReady = resolve; });
    const first = execute(`begin; set local role service_role;
      select pg_advisory_xact_lock(hashtextextended('claimant:offline-v2:case-binding:${id.claimant}',0));
      select 'LOCK_READY'; select pg_sleep(1);
      select public.claimant_offline_code_v2_handoff('consume','${id.claimant}','${id.session}',
        '${handoff}','${completionKey}','${transcript}','${digest("S")}'); commit;`,
    (data) => { if (data.includes("LOCK_READY")) signalReady(); });
    await Promise.race([ready, first.then(() => { throw new Error("Missing handoff lock marker"); })]);
    const second = execute(`begin; set local role service_role;
      select public.claimant_offline_code_v2_handoff('consume','${id.claimant}','${id.session}',
        '${handoff}','${completionKey}','${transcript}','${digest("S")}'); commit;`);
    const results = await Promise.allSettled([first, second]);
    for (const result of results) if (result.status === "rejected") throw result.reason;
    if (sync(`select count(*) from public.claimant_cases
      where offline_code_v2_locator_record_id = '${id.locator}';`) !== "1")
      throw new Error("Concurrent handoff created more than one case.");
  } finally {
    sync(`begin;
      delete from public.claimant_offline_code_v2_handoffs where source_challenge_id = '${id.challenge}';
      delete from public.claimant_audit_events where actor_user_id in ('${id.claimant}','${id.other}');
      delete from public.claimant_idempotency_records where actor_user_id in ('${id.claimant}','${id.other}');
      delete from public.claimant_cases where offline_code_v2_locator_record_id = '${id.locator}';
      delete from public.claimant_identities where user_id in ('${id.claimant}','${id.other}');
      delete from public.claimant_offline_code_v2_events where locator_record_id = '${id.locator}';
      delete from public.claimant_offline_code_v2_challenges where id = '${id.challenge}';
      delete from public.claimant_offline_code_v2_locators where id = '${id.locator}';
      delete from public.claimant_portal_session_controls where user_id in ('${id.claimant}','${id.other}');
      delete from public.claimant_portal_eligibilities where user_id in ('${id.claimant}','${id.other}');
      delete from auth.users where id in ('${id.claimant}','${id.other}','${id.owner}'); commit;`);
  }
}

if (require.main === module) {
  const flag = process.argv.indexOf("--container");
  runOfflineCodeV2HandoffDbTest({ container: flag >= 0 ? process.argv[flag + 1] : undefined })
    .then(() => console.log("Claimant offline-code V2 authenticated handoff DB test passed."))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
module.exports = { buildOfflineCodeV2HandoffDbTestSql, runOfflineCodeV2HandoffDbTest };
