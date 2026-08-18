const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");

const migration = readFileSync(resolve(__dirname,
  "../supabase/migrations/20260818075248_claimant_owner_notice_delivery_queue.sql"), "utf8");
const client = readFileSync(resolve(__dirname,
  "../services/api/src/claimant/owner-notice-queue-transaction-client.ts"), "utf8");
const index = readFileSync(resolve(__dirname, "../services/api/src/index.ts"), "utf8");

test("creates a forced-RLS service-only owner-notice delivery queue", () => {
  assert.match(migration, /create table public\.claimant_owner_notice_deliveries/);
  assert.match(migration, /force row level security/);
  for (const role of ["public", "anon", "authenticated"]) {
    assert.match(migration, new RegExp(`revoke all on table public\\.claimant_owner_notice_deliveries from ${role}`));
  }
  assert.match(migration, /grant select, insert, update on table public\.claimant_owner_notice_deliveries to service_role/);
});

test("persists stable keys before contact and reclaims only expired leases", () => {
  assert.match(migration, /delivery_idempotency_key uuid not null default gen_random_uuid\(\) unique/);
  assert.match(migration, /dispatch_key text generated always as/);
  assert.match(migration, /d\.lease_expires_at <= now\(\)/);
  assert.match(migration, /for update of o skip locked limit 1/);
  assert.match(migration, /attempt_number = attempt_number \+ 1/);
  assert.match(migration, /lease_token = v_lease_token/);
});

test("binds completion to the current lease and committed protection outcome", () => {
  assert.match(migration, /v_delivery\.lease_token <> p_lease_token/);
  assert.match(migration, /v_delivery\.lease_expires_at <= now\(\)/);
  assert.match(migration, /v_case\.version <> p_case_version/);
  assert.match(migration, /v_cycle\.status <> 'delivery_verified'/);
  assert.match(migration, /v_cycle\.status <> 'delivery_' \|\| p_outcome/);
  assert.match(migration, /Owner notice completion replay changed/);
});

test("keeps both functions invoker-only, service-only, and unmounted", () => {
  assert.equal((migration.match(/language plpgsql security invoker set search_path = ''/g) ?? []).length, 2);
  for (const fn of ["claimant_claim_owner_notice_delivery", "claimant_complete_owner_notice_delivery"]) {
    for (const role of ["public", "anon", "authenticated"]) {
      assert.match(migration, new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*?from ${role}`));
    }
    assert.match(migration, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*?to service_role`));
  }
  assert.doesNotMatch(migration, /security definer/);
  assert.doesNotMatch(index, /owner-notice-queue-transaction-client/);
  assert.doesNotMatch(client, /NEXT_PUBLIC|localStorage|document\.|window\./);
});
