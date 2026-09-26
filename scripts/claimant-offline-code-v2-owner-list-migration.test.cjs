const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const migration = readFileSync(join(__dirname,
  "../supabase/migrations/20260926090000_claimant_offline_code_v2_owner_locator_list.sql"), "utf8");
const body = migration.slice(migration.indexOf("as $function$"), migration.lastIndexOf("$function$"));

test("adds one read-only, service-only security-invoker owner list function", () => {
  assert.equal((migration.match(/create function public\./gu) ?? []).length, 1);
  assert.match(migration, /claimant_list_offline_code_v2_locators\(p_owner_user_id uuid\)/u);
  assert.match(migration, /returns jsonb language sql stable security invoker set search_path = ''/u);
  assert.match(migration, /revoke all on function public\.claimant_list_offline_code_v2_locators\(uuid\) from public, anon, authenticated;/u);
  assert.match(migration, /grant execute on function public\.claimant_list_offline_code_v2_locators\(uuid\) to service_role;/u);
  for (const forbidden of ["insert ", "update ", "delete ", "security definer", "create table", "alter table",
    "create policy", "to authenticated", "to anon"])
    assert.equal(migration.toLowerCase().includes(forbidden), false, forbidden);
});

test("returns only the owner's sheets with dates and status, capped at fifty", () => {
  assert.match(body, /where owner_user_id = p_owner_user_id/u);
  assert.match(body, /limit 50/u);
  assert.match(body, /when l\.status = 'active' and l\.expires_at <= now\(\) then 'expired'/u);
  for (const forbidden of ["locator_index_digest", "locator_commitment", "proof_public_key", "record_binding_digest",
    "wrap_", "kdf_salt", "grant_id", "failed_attempt_count", "locked_until", "owner_user_id',"])
    assert.equal(body.includes(forbidden), false, forbidden);
});
