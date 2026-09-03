const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const migration = readFileSync(join(__dirname,
  "../supabase/migrations/20260819080343_claimant_offline_code_v2_persistence.sql"), "utf8");
const challengeMigration = readFileSync(join(__dirname,
  "../supabase/migrations/20260819084008_offline_code_v2_enumeration_resistant_challenges.sql"), "utf8");
const digest = (character) => `${character.repeat(42)}Q`;

function registration(ids, prefix) {
  return `public.claimant_register_offline_code_v2_locator('${ids.locator}', '${ids.owner}',
    '${digest(prefix)}', '${digest("C")}', '${ids.grant}', '${digest("P")}', '${digest("B")}',
    '${"K".repeat(21)}A', '${"N".repeat(32)}', '${"W".repeat(64)}', '${digest("A")}', v_now,
    v_now + interval '30 days', '${ids.registerKey}')`;
}

function challenge(prefix, key) {
  return `public.claimant_issue_offline_code_v2_challenge('${digest(prefix)}',
    '${digest("I")}', '${digest("E")}', '${digest("G")}',
    'https://claim.synthetic.test', '${key}')`;
}

function challengeField(key, field) {
  return `(select result ${field} from public.claimant_offline_code_v2_idempotency
    where operation = 'issue_challenge' and idempotency_key = '${key}')`;
}

function attempt(ids, challengeKey, outcome, key, signatureCharacter) {
  return `public.claimant_record_offline_code_v2_attempt('${ids.locator}',
    ${challengeField(challengeKey, "#>> '{challenge,challenge_id}'")}::uuid,
    ${challengeField(challengeKey, "->> 'challenge_bytes_digest'")},
    '${digest("B")}', '${digest(signatureCharacter)}', '${outcome}', '${key}')`;
}

function buildOfflineCodeV2PersistenceDbTestSql(options = {}) {
  const first = { locator: randomUUID(), owner: randomUUID(), grant: randomUUID(),
    registerKey: randomUUID() };
  const second = { locator: randomUUID(), owner: first.owner, grant: randomUUID(),
    registerKey: randomUUID() };
  const firstChallengeKeys = Array.from({ length: 5 }, () => randomUUID());
  const firstAttemptKeys = Array.from({ length: 5 }, () => randomUUID());
  const verifiedChallengeKey = randomUUID();
  const verifiedAttemptKey = randomUUID();
  const revokedChallengeKey = randomUUID();
  const revokeKey = randomUUID();
  const hostileKey = randomUUID();
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
  const invalidCases = firstChallengeKeys.slice(1).map((challengeKey, index) => `
  perform ${challenge("L", challengeKey)};
  v_result := ${attempt(first, challengeKey, "invalid", firstAttemptKeys[index + 1], "S")};`).join("");
  return `begin;${setup}
${options.standalone ? migration + challengeMigration : ""}
insert into auth.users (id) values ('${first.owner}') on conflict do nothing;
set local role service_role;
do $test$
declare v_now timestamptz := date_trunc('milliseconds', clock_timestamp());
  v_result jsonb; v_locked jsonb; v_unknown jsonb;
begin
  v_result := ${registration(first, "L")};
  if v_result ->> 'authority' <> 'route_possession_only'
    or (v_result ->> 'claim_created')::boolean
    or (v_result ->> 'release_authorized')::boolean
    or not (v_result ->> 'synthetic_only')::boolean then
    raise exception 'registration result was unsafe'; end if;
  if not (${registration(first, "L")} ->> 'replayed')::boolean then
    raise exception 'registration replay was unstable'; end if;
  perform ${registration(second, "K")};
  v_result := ${challenge("L", firstChallengeKeys[0])};
  if (v_result ->> 'claim_created')::boolean or (v_result ->> 'release_authorized')::boolean
    or v_result #>> '{challenge,authority}' <> 'route_possession_only' then
    raise exception 'challenge result was unsafe'; end if;
  if not (${challenge("L", firstChallengeKeys[0])} ->> 'replayed')::boolean then
    raise exception 'challenge replay was unstable'; end if;
  v_result := ${attempt(first, firstChallengeKeys[0], "invalid", firstAttemptKeys[0], "S")};
  if (v_result ->> 'route_possession_asserted')::boolean
    or (v_result ->> 'identity_verified')::boolean
    or (v_result ->> 'claim_created')::boolean
    or (v_result ->> 'release_authorized')::boolean then
    raise exception 'invalid proof result was unsafe'; end if;${invalidCases}
  if not (v_result ->> 'locator_locked')::boolean
    or (select failed_attempt_count from public.claimant_offline_code_v2_locators
      where id = '${first.locator}') <> 5
    or (select locked_until from public.claimant_offline_code_v2_locators
      where id = '${first.locator}') <= clock_timestamp() then
    raise exception 'five failures did not lock the locator'; end if;
  -- Isolate locator lockout from the separately tested challenge rate limiter.
  delete from public.claimant_offline_code_v2_rate_limits
    where scope_type = 'locator' and scope_digest = '${digest("L")}';
  v_locked := ${challenge("L", hostileKey)};
  v_unknown := ${challenge("U", randomUUID())};
  if not (v_locked @> '{"rate_limited":false,"identity_verified":false,"claim_created":false,"release_authorized":false}'::jsonb)
    or not (v_unknown @> '{"rate_limited":false,"identity_verified":false,"claim_created":false,"release_authorized":false}'::jsonb)
    or v_locked ? 'record_found' or v_unknown ? 'record_found'
    or (select array_agg(key order by key) from jsonb_object_keys(v_locked) key)
      is distinct from (select array_agg(key order by key) from jsonb_object_keys(v_unknown) key)
    or (select array_agg(key order by key) from jsonb_object_keys(v_locked -> 'challenge') key)
      is distinct from (select array_agg(key order by key) from jsonb_object_keys(v_unknown -> 'challenge') key)
    or v_locked #>> '{challenge,authority}' is distinct from 'route_possession_only'
    or v_unknown #>> '{challenge,authority}' is distinct from 'route_possession_only'
    or (select count(*) from public.claimant_offline_code_v2_challenges) <> 5 then
    raise exception 'locked or unknown locator exposed availability or persisted a challenge'; end if;
  perform ${challenge("K", verifiedChallengeKey)};
  v_result := ${attempt(second, verifiedChallengeKey, "verified", verifiedAttemptKey, "V")};
  if not (v_result ->> 'route_possession_asserted')::boolean
    or (v_result ->> 'identity_verified')::boolean
    or (v_result ->> 'claim_created')::boolean
    or (v_result ->> 'release_authorized')::boolean then
    raise exception 'verified proof exceeded route possession'; end if;
  if not (${attempt(second, verifiedChallengeKey, "verified", verifiedAttemptKey, "V")}
    ->> 'replayed')::boolean then raise exception 'attempt replay was unstable'; end if;
  perform ${challenge("K", revokedChallengeKey)};
  v_result := public.claimant_revoke_offline_code_v2_locator('${second.locator}', '${second.owner}',
    2, 'owner_revoked', '${revokeKey}');
  if v_result ->> 'status' <> 'revoked' or (v_result ->> 'future_challenges_allowed')::boolean
    or (v_result ->> 'claim_created')::boolean or (v_result ->> 'release_authorized')::boolean then
    raise exception 'revocation result was unsafe'; end if;
  if not (${challenge("K", revokedChallengeKey)} ->> 'replayed')::boolean then
    raise exception 'issued challenge replay changed after revocation'; end if;
  if (select status from public.claimant_offline_code_v2_challenges
      where id = ${challengeField(revokedChallengeKey, "#>> '{challenge,challenge_id}'")}::uuid) <> 'revoked'
    or (select count(*) from public.claimant_offline_code_v2_attempts) <> 6
    or (select count(*) from public.claimant_offline_code_v2_locators) <> 2 then
    raise exception 'atomic persistence facts were incomplete'; end if;
  if exists (select 1 from public.claimant_offline_code_v2_events where metadata ?| array[
    'locator_index_digest', 'locator_commitment', 'proof_signature_digest', 'wrap_ciphertext']) then
    raise exception 'event metadata retained sensitive values'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_offline_code_v2_locators;
    raise exception 'authenticated role read locators';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_revoke_offline_code_v2_locator('${second.locator}', '${second.owner}',
    2, 'owner_revoked', '${hostileKey}');
    raise exception 'authenticated role called persistence RPC';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_OFFLINE_CODE_V2_PERSISTENCE_DB_TEST_PASSED';`;
}

function runOfflineCodeV2PersistenceDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildOfflineCodeV2PersistenceDbTestSql(options) });
  if (!output.includes("CLAIMANT_OFFLINE_CODE_V2_PERSISTENCE_DB_TEST_PASSED"))
    throw new Error("Offline-code V2 persistence DB marker was missing.");
}

if (require.main === module) {
  const standalone = process.argv.includes("--standalone");
  const flag = process.argv.indexOf("--container");
  runOfflineCodeV2PersistenceDbTest({ standalone,
    container: flag >= 0 ? process.argv[flag + 1] : undefined });
  console.log("Claimant offline-code V2 persistence DB test passed.");
}

module.exports = { buildOfflineCodeV2PersistenceDbTestSql, runOfflineCodeV2PersistenceDbTest };
