const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260819084008_offline_code_v2_enumeration_resistant_challenges.sql"), "utf8");
const coordinator = readFileSync(join(root,
  "services/api/src/claimant/offline-code-v2-challenge-coordinator.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("adds a fail-closed per-record KDF salt and server-only rate budget", () => {
  assert.match(migration, /add column kdf_salt text null/u);
  assert.match(migration, /v_locator\.kdf_salt is not null/u);
  assert.match(migration, /create table public\.claimant_offline_code_v2_rate_limits/u);
  assert.match(migration, /force row level security/u);
  assert.match(migration, /from authenticated;/u);
  assert.match(migration, /using \(false\) with check \(false\)/u);
});

test("consumes global, network, device, and locator budgets before lookup", () => {
  for (const token of ["('global', p_global_bucket_digest, 60, 1000)",
    "('network', p_network_bucket_digest, 300, 20)",
    "('locator', p_locator_index_digest, 300, 5)",
    "('device', p_device_bucket_digest, 300, 10)"])
    assert.ok(migration.includes(token), token);
  assert.ok(migration.indexOf("insert into public.claimant_offline_code_v2_rate_limits")
    < migration.indexOf("select * into v_locator"));
  assert.match(migration, /'rate_limited', true, 'retry_after_seconds', 300/u);
});

test("generates a constant canonical challenge for available and synthetic records", () => {
  for (const token of ["v_locator_record_id := case when v_available",
    "v_locator_commitment := case when v_available", "v_kdf_salt := case when v_available",
    "v_challenge_text := concat", "v_challenge_bytes := rtrim",
    "'protocol', 'sanduqkin:claim:offline-code:v2'", "'authority', 'route_possession_only'"])
    assert.ok(migration.includes(token), token);
  assert.doesNotMatch(migration, /record_found|locator_found|synthetic_challenge/u);
  assert.match(migration, /if v_available then\s+update public\.claimant_offline_code_v2_challenges/u);
});

test("keeps replay stable under a derived opaque scope", () => {
  assert.match(migration, /'claimant:offline-v2:scope:' \|\| p_locator_index_digest/u);
  assert.ok(migration.indexOf("select * into v_existing")
    < migration.indexOf("delete from public.claimant_offline_code_v2_rate_limits"));
  assert.match(migration, /return v_existing\.result \|\| jsonb_build_object\('replayed', true\)/u);
  assert.match(migration, /values \('issue_challenge', v_scope_id, p_idempotency_key/u);
});

test("uses narrowed service-only invoker functions and remains unmounted", () => {
  assert.equal((migration.match(/security invoker set search_path = ''/g) ?? []).length, 2);
  assert.equal((migration.match(/revoke all on function public\.claimant_/g) ?? []).length, 2);
  assert.equal((migration.match(/grant execute on function public\.claimant_/g) ?? []).length, 2);
  assert.match(coordinator,
    /CLAIMANT_OFFLINE_CODE_V2_CHALLENGE_COORDINATOR_APPROVED = false as const/u);
  assert.equal(index.includes("offline-code-v2-challenge-coordinator"), false);
});
