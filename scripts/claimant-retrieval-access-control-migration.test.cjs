const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260819000000_claimant_retrieval_suspension_expiry.sql"), "utf8");
const service = readFileSync(join(root,
  "services/api/src/claimant/retrieval-access-control-service.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("creates three forced-RLS access-control tables with explicit denial", () => {
  for (const table of ["claimant_retrieval_access_controls",
    "claimant_retrieval_access_control_events",
    "claimant_retrieval_access_control_idempotency"])
    assert.ok(migration.includes(`create table public.${table}`), table);
  assert.equal((migration.match(/force row level security/g) ?? []).length, 3);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 3);
  assert.ok((migration.match(/create index claimant_retrieval_access/g) ?? []).length >= 5);
});

test("models suspension and expiry without rewriting served or completed truth", () => {
  for (const token of ["access_ended_unserved", "access_ended_served_unrecalled",
    "access_ended_completed_unrecalled", "package_was_served boolean not null",
    "retrieval_was_completed boolean not null", "not retrieval_was_completed or package_was_served"])
    assert.ok(migration.includes(token), token);
  assert.doesNotMatch(migration, /set\s+package_served\s*=\s*false/u);
  assert.doesNotMatch(migration, /set\s+retrieval_completed\s*=\s*false/u);
});

test("fixes future authority, recall, deletion, export and closure claims safely", () => {
  for (const token of ["future_serving_authorized boolean not null default false",
    "future_retrieval_authorized boolean not null default false",
    "local_content_recalled boolean not null default false",
    "local_content_deleted boolean not null default false",
    "'local_content_recalled', false", "'local_content_deleted', false"])
    assert.ok(migration.includes(token), token);
  assert.doesNotMatch(migration, /update public\.claimant_retrieval_completions/u);
});

test("serializes against authorization, delivery and completion before ending access", () => {
  for (const token of ["'claimant:release-retrieval-session:'",
    "'claimant:encrypted-package-delivery:'", "order by id for update",
    "v_finalization.status <> 'finalized_release_ready'",
    "p_control_state = 'expired' and v_finalization.expires_at > v_now"])
    assert.ok(migration.includes(token), token);
  assert.ok(migration.indexOf("perform 1 from public.claimant_encrypted_package_deliveries")
    < migration.indexOf("select * into v_case"));
});

test("uses a service-only invoker function with stable idempotency", () => {
  assert.match(migration, /language plpgsql\s+security invoker\s+set search_path = ''/u);
  assert.match(migration, /revoke all on function public\.claimant_end_release_retrieval_access\(/u);
  assert.match(migration, /grant execute on function public\.claimant_end_release_retrieval_access/u);
  assert.match(migration, /v_existing\.request_digest <> v_request_digest/u);
});

test("keeps access control immutable-false and unmounted", () => {
  assert.match(service, /CLAIMANT_RETRIEVAL_ACCESS_CONTROL_APPROVED = false as const/u);
  assert.equal(index.includes("retrieval-access-control-service"), false);
  assert.equal(index.includes("retrieval-access-control-transaction-client"), false);
});
