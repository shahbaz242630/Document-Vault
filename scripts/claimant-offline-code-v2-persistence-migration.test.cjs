const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260819080343_claimant_offline_code_v2_persistence.sql"), "utf8");
const service = readFileSync(join(root,
  "services/api/src/claimant/offline-code-v2-persistence-service.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

const tables = ["locators", "challenges", "attempts", "events", "idempotency"];

test("creates five forced-RLS server-only persistence tables", () => {
  for (const suffix of tables)
    assert.ok(migration.includes(`create table public.claimant_offline_code_v2_${suffix}`), suffix);
  assert.equal((migration.match(/force row level security/g) ?? []).length, 5);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 5);
  assert.equal((migration.match(/from authenticated;/g) ?? []).length, 5);
});

test("stores only keyed locator and proof digests with synthetic wrapped material", () => {
  for (const token of ["locator_index_digest text not null unique", "locator_commitment text not null",
    "proof_public_key text not null", "record_binding_digest text not null",
    "wrap_nonce text not null", "wrap_ciphertext text not null",
    "kdf_profile_id text not null default 'argon2id-synthetic-test-v2'",
    "synthetic_only boolean not null default true check (synthetic_only = true)"])
    assert.ok(migration.includes(token), token);
  for (const forbidden of ["raw_locator", "normalized_locator", "client_secret",
    "proof_private_key", "plaintext_mek", "root_secret"])
    assert.equal(migration.includes(forbidden), false, forbidden);
});

test("enforces five-minute challenges, five failures, and a fifteen-minute lock", () => {
  assert.match(migration, /expires_at = issued_at \+ interval '5 minutes'/u);
  assert.match(migration, /where status = 'issued'/u);
  assert.match(migration, /failed_attempt_count integer not null default 0 check \(failed_attempt_count between 0 and 5\)/u);
  assert.match(migration, /set locked_until = now\(\) \+ interval '15 minutes'/u);
  assert.match(migration, /verification_outcome in \('invalid', 'verified'\)/u);
  assert.match(migration, /'route_possession_asserted', p_verification_outcome = 'verified'/u);
});

test("uses stable replay and four service-only security-invoker transactions", () => {
  assert.equal((migration.match(/security invoker set search_path = ''/g) ?? []).length, 4);
  assert.equal((migration.match(/revoke all on function public\.claimant_/g) ?? []).length, 4);
  assert.equal((migration.match(/grant execute on function public\.claimant_/g) ?? []).length, 4);
  assert.equal((migration.match(/v_existing\.request_digest <> v_digest/g) ?? []).length, 4);
  for (const name of ["register_offline_code_v2_locator", "issue_offline_code_v2_challenge",
    "record_offline_code_v2_attempt", "revoke_offline_code_v2_locator"])
    assert.ok(migration.includes(`create function public.claimant_${name}`), name);
});

test("makes no identity, claim, or release authorization and remains unmounted", () => {
  assert.match(migration, /'identity_verified', false/u);
  assert.ok((migration.match(/'claim_created', false/g) ?? []).length >= 4);
  assert.ok((migration.match(/'release_authorized', false/g) ?? []).length >= 4);
  assert.match(service, /CLAIMANT_OFFLINE_CODE_V2_PERSISTENCE_APPROVED = false as const/u);
  assert.equal(index.includes("offline-code-v2-persistence-service"), false);
  assert.equal(index.includes("offline-code-v2-persistence-transaction-client"), false);
});
