const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const migrations = ["20260819080343_claimant_offline_code_v2_persistence.sql",
  "20260819084008_offline_code_v2_enumeration_resistant_challenges.sql",
  "20260926090000_claimant_offline_code_v2_owner_locator_list.sql"]
  .map((name) => readFileSync(join(__dirname, "../supabase/migrations", name), "utf8"));
const digest = (character) => `${character.repeat(42)}Q`;

/*
 * Slice 6J: the owner sheet list returns only the owner's own sheets, newest first, with dates and a status, and
 * reports an overdue active sheet as expired. Only service_role may call it; direct table reads stay denied.
 */
function buildOfflineCodeV2OwnerListDbTestSql(options = {}) {
  const owner = randomUUID(); const other = randomUUID();
  const ids = { active: randomUUID(), overdue: randomUUID(), revoked: randomUUID(), foreign: randomUUID() };
  const locator = (id, ownerId, character, status, issuedDaysAgo) => `
  insert into public.claimant_offline_code_v2_locators (id, owner_user_id, locator_index_digest,
    locator_commitment, grant_id, proof_public_key, record_binding_digest, wrap_nonce, wrap_ciphertext,
    wrap_associated_data_digest, kdf_salt, status, issued_at, expires_at, revoked_at, terminal_reason)
  values ('${id}', '${ownerId}', '${digest(character)}', '${digest("C")}', '${randomUUID()}', '${digest("P")}',
    '${digest("B")}', '${"N".repeat(32)}', '${"W".repeat(64)}', '${digest("A")}', '${"K".repeat(21)}A',
    '${status}', now() - interval '${issuedDaysAgo} days', now() - interval '${issuedDaysAgo} days' + interval '30 days',
    ${status === "revoked" ? "now()" : "null"}, ${status === "revoked" ? "'owner_revoked'" : "null"});`;
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
${migrations.join("\n")}` : "";
  return `begin;${setup}
insert into auth.users (id) values ('${owner}'), ('${other}') on conflict do nothing;
${locator(ids.active, owner, "L", "active", 1)}
${locator(ids.overdue, owner, "M", "active", 40)}
${locator(ids.revoked, owner, "N", "revoked", 5)}
${locator(ids.foreign, other, "O", "active", 0)}
set local role service_role;
do $test$
declare v_result jsonb := public.claimant_list_offline_code_v2_locators('${owner}');
  v_sheet jsonb;
begin
  if v_result - 'sheets' <> '{"synthetic_only":true,"claim_created":false,"release_authorized":false}'::jsonb then
    raise exception 'list envelope was unsafe'; end if;
  if (select array_agg(value ->> 'locator_record_id') from jsonb_array_elements(v_result -> 'sheets'))
    <> array['${ids.active}', '${ids.revoked}', '${ids.overdue}'] then
    raise exception 'list did not return only the owner''s sheets, newest first'; end if;
  if (select array_agg(value ->> 'status') from jsonb_array_elements(v_result -> 'sheets'))
    <> array['active', 'revoked', 'expired'] then
    raise exception 'list statuses were wrong'; end if;
  for v_sheet in select value from jsonb_array_elements(v_result -> 'sheets') loop
    if (select array_agg(key order by key) from jsonb_object_keys(v_sheet) key)
      <> array['expires_at', 'issued_at', 'locator_record_id', 'revoked_at', 'status'] then
      raise exception 'list exposed a field outside the allowed set'; end if;
  end loop;
  if (select status from public.claimant_offline_code_v2_locators where id = '${ids.overdue}') <> 'active' then
    raise exception 'listing changed a row'; end if;
  if jsonb_array_length(public.claimant_list_offline_code_v2_locators('${randomUUID()}') -> 'sheets') <> 0 then
    raise exception 'an unknown owner saw sheets'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform public.claimant_list_offline_code_v2_locators('${owner}');
    raise exception 'authenticated role called the owner list';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.claimant_offline_code_v2_locators;
    raise exception 'authenticated role read locators';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
set local role anon;
do $denied$ begin
  begin perform public.claimant_list_offline_code_v2_locators('${owner}');
    raise exception 'anon role called the owner list';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_OFFLINE_CODE_V2_OWNER_LIST_DB_TEST_PASSED';`;
}

function runOfflineCodeV2OwnerListDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildOfflineCodeV2OwnerListDbTestSql(options) });
  if (!output.includes("CLAIMANT_OFFLINE_CODE_V2_OWNER_LIST_DB_TEST_PASSED"))
    throw new Error("Offline-code V2 owner list DB marker was missing.");
}

if (require.main === module) {
  const standalone = process.argv.includes("--standalone");
  const flag = process.argv.indexOf("--container");
  runOfflineCodeV2OwnerListDbTest({ standalone, container: flag >= 0 ? process.argv[flag + 1] : undefined });
  console.log("Claimant offline-code V2 owner list DB test passed.");
}

module.exports = { buildOfflineCodeV2OwnerListDbTestSql, runOfflineCodeV2OwnerListDbTest };
