const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const persistenceMigration = readFileSync(join(__dirname,
  "../supabase/migrations/20260819080343_claimant_offline_code_v2_persistence.sql"), "utf8");
const challengeMigration = readFileSync(join(__dirname,
  "../supabase/migrations/20260819084008_offline_code_v2_enumeration_resistant_challenges.sql"), "utf8");
const digest = (character) => `${character.repeat(42)}Q`;

function issue(locatorDigest, key, networkDigest = digest("I")) {
  return `public.claimant_issue_offline_code_v2_challenge('${locatorDigest}',
    '${networkDigest}', '${digest("E")}', '${digest("G")}',
    'https://claim.synthetic.test', '${key}')`;
}

function buildOfflineCodeV2ChallengeDbTestSql(options = {}) {
  const ids = { owner: randomUUID(), locator: randomUUID(), grant: randomUUID(),
    register: randomUUID(), known: randomUUID(), unknown: randomUUID(), revoke: randomUUID() };
  const limitedKeys = Array.from({ length: 6 }, () => randomUUID());
  const setup = options.standalone ? `
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $roles$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $roles$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to service_role;
` : "";
  const limiterCalls = limitedKeys.slice(0, 5).map((key) =>
    `perform ${issue(digest("X"), key, digest("J"))};`).join("\n  ");
  const migrations = options.standalone || options.applyMigrations
    ? `${persistenceMigration}\n${challengeMigration}` : "";
  return `begin;${setup}
${migrations}
insert into auth.users (id) values ('${ids.owner}') on conflict do nothing;
set local role service_role;
do $test$
declare v_now timestamptz := date_trunc('milliseconds', clock_timestamp());
  v_known jsonb; v_known_replay jsonb; v_unknown jsonb; v_unknown_replay jsonb;
  v_revoked jsonb; v_limited jsonb; v_bytes bytea;
begin
  perform public.claimant_register_offline_code_v2_locator('${ids.locator}', '${ids.owner}',
    '${digest("L")}', '${digest("C")}', '${ids.grant}', '${digest("P")}', '${digest("B")}',
    '${"K".repeat(21)}A', '${"N".repeat(32)}', '${"W".repeat(64)}', '${digest("A")}',
    v_now, v_now + interval '30 days', '${ids.register}');
  v_known := ${issue(digest("L"), ids.known)};
  v_unknown := ${issue(digest("U"), ids.unknown)};
  if (v_known ->> 'rate_limited')::boolean or (v_unknown ->> 'rate_limited')::boolean
    or (v_known ->> 'identity_verified')::boolean or (v_unknown ->> 'identity_verified')::boolean
    or (v_known ->> 'claim_created')::boolean or (v_unknown ->> 'claim_created')::boolean
    or (v_known ->> 'release_authorized')::boolean or (v_unknown ->> 'release_authorized')::boolean
    or v_known ? 'record_found' or v_unknown ? 'record_found'
    or v_known ? 'synthetic' or v_unknown ? 'synthetic' then
    raise exception 'challenge result exposed authority or record existence'; end if;
  if (select array_agg(key order by key) from jsonb_object_keys(v_known) key)
      <> (select array_agg(key order by key) from jsonb_object_keys(v_unknown) key)
    or (select array_agg(key order by key) from jsonb_object_keys(v_known -> 'challenge') key)
      <> (select array_agg(key order by key) from jsonb_object_keys(v_unknown -> 'challenge') key)
    or (select array_agg(key order by key) from jsonb_object_keys(v_known -> 'kdf_profile') key)
      <> (select array_agg(key order by key) from jsonb_object_keys(v_unknown -> 'kdf_profile') key) then
    raise exception 'known and unknown challenge schemas differed'; end if;
  if v_known #>> '{kdf_profile,salt}' <> '${"K".repeat(21)}A'
    or v_known #>> '{challenge,authority}' <> 'route_possession_only'
    or v_known #>> '{challenge,protocol}' <> 'sanduqkin:claim:offline-code:v2'
    or v_known #>> '{challenge,origin}' <> 'https://claim.synthetic.test'
    or (v_known #>> '{challenge,expires_at}')::timestamptz
      <> (v_known #>> '{challenge,issued_at}')::timestamptz + interval '5 minutes' then
    raise exception 'known challenge bindings were invalid'; end if;
  v_bytes := decode(translate(v_known ->> 'challenge_bytes_base64url', '-_', '+/')
    || repeat('=', (4 - length(v_known ->> 'challenge_bytes_base64url') % 4) % 4), 'base64');
  if rtrim(translate(encode(extensions.digest(v_bytes, 'sha256'), 'base64'), '+/', '-_'), '=')
      <> v_known ->> 'challenge_bytes_digest'
    or convert_from(v_bytes, 'UTF8')::jsonb <> v_known -> 'challenge' then
    raise exception 'canonical challenge bytes were invalid'; end if;
  if (select count(*) from public.claimant_offline_code_v2_challenges) <> 1
    or (select count(*) from public.claimant_offline_code_v2_events
      where event_type = 'challenge_issued') <> 1 then
    raise exception 'synthetic challenge persisted record facts'; end if;
  v_known_replay := ${issue(digest("L"), ids.known)};
  v_unknown_replay := ${issue(digest("U"), ids.unknown)};
  if not (v_known_replay ->> 'replayed')::boolean
    or not (v_unknown_replay ->> 'replayed')::boolean
    or v_known_replay - 'replayed' <> v_known - 'replayed'
    or v_unknown_replay - 'replayed' <> v_unknown - 'replayed' then
    raise exception 'known or synthetic replay was unstable'; end if;
  perform public.claimant_revoke_offline_code_v2_locator('${ids.locator}', '${ids.owner}',
    2, 'owner_revoked', '${ids.revoke}');
  v_revoked := ${issue(digest("L"), randomUUID(), digest("R"))};
  if (v_revoked ->> 'rate_limited')::boolean
    or (select count(*) from public.claimant_offline_code_v2_challenges) <> 1
    or (select status from public.claimant_offline_code_v2_challenges) <> 'revoked' then
    raise exception 'revoked locator did not use a synthetic challenge'; end if;
  ${limiterCalls}
  v_limited := ${issue(digest("X"), limitedKeys[5], digest("J"))};
  if not (v_limited ->> 'rate_limited')::boolean
    or (v_limited ->> 'retry_after_seconds')::integer <> 300
    or v_limited ? 'challenge' or v_limited ? 'kdf_profile'
    or (v_limited ->> 'identity_verified')::boolean
    or (v_limited ->> 'claim_created')::boolean
    or (v_limited ->> 'release_authorized')::boolean then
    raise exception 'locator limiter result was unsafe'; end if;
  if (select request_count from public.claimant_offline_code_v2_rate_limits
      where scope_type = 'locator' and scope_digest = '${digest("X")}') <> 6 then
    raise exception 'locator rate budget was not consumed'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_offline_code_v2_rate_limits;
    raise exception 'authenticated role read rate limits';
  exception when insufficient_privilege then null; end;
  begin perform ${issue(digest("U"), randomUUID())};
    raise exception 'authenticated role called challenge RPC';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_OFFLINE_CODE_V2_CHALLENGE_DB_TEST_PASSED';`;
}

function runOfflineCodeV2ChallengeDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildOfflineCodeV2ChallengeDbTestSql(options) });
  if (!output.includes("CLAIMANT_OFFLINE_CODE_V2_CHALLENGE_DB_TEST_PASSED"))
    throw new Error("Offline-code V2 challenge DB marker was missing.");
}

if (require.main === module) {
  const standalone = process.argv.includes("--standalone");
  const flag = process.argv.indexOf("--container");
  runOfflineCodeV2ChallengeDbTest({ standalone,
    container: flag >= 0 ? process.argv[flag + 1] : undefined });
  console.log("Claimant offline-code V2 challenge DB test passed.");
}
module.exports = { buildOfflineCodeV2ChallengeDbTestSql, runOfflineCodeV2ChallengeDbTest };
