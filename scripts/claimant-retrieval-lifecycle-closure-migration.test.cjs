const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260819010000_claimant_retrieval_lifecycle_closure.sql"), "utf8");
const service = readFileSync(join(root,
  "services/api/src/claimant/retrieval-lifecycle-closure-service.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("creates three forced-RLS closure tables with explicit denial", () => {
  for (const table of ["claimant_retrieval_lifecycle_closures",
    "claimant_retrieval_lifecycle_closure_events",
    "claimant_retrieval_lifecycle_closure_idempotency"])
    assert.ok(migration.includes(`create table public.${table}`), table);
  assert.equal((migration.match(/force row level security/g) ?? []).length, 3);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 3);
  assert.ok((migration.match(/create index claimant_retrieval_lifecycle/g) ?? []).length >= 6);
});

test("records only administrative closure while preserving historical truth", () => {
  for (const token of ["closure_recorded boolean not null default true check (closure_recorded)",
    "local_content_recalled boolean not null default false check (not local_content_recalled)",
    "local_content_deleted boolean not null default false check (not local_content_deleted)",
    "historical_delivery_preserved boolean not null default true",
    "historical_completion_preserved boolean not null default true"])
    assert.ok(migration.includes(token), token);
  for (const table of ["claimant_retrieval_completions",
    "claimant_encrypted_package_deliveries", "claimant_release_retrieval_sessions"])
    assert.doesNotMatch(migration, new RegExp(`update public\\.${table}`, "u"));
});

test("requires completed authority and optional all-or-none export evidence", () => {
  for (const token of ["not v_delivery.package_served or not v_delivery.retrieval_completed",
    "not v_session.package_served or not v_session.retrieval_completed",
    "v_completion.export_performed or v_completion.closure_recorded",
    "v_delivery.access_state <> v_session.access_state",
    "select 1 from public.claimant_retrieval_access_controls",
    "export_receipt_digest is not null", "verified_export_fact_digest is not null",
    "exported_at is not null"])
    assert.ok(migration.includes(token), token);
});

test("uses consistent locking, stable replay and a service-only invoker function", () => {
  assert.ok(migration.indexOf("'claimant:release-retrieval-session:'")
    < migration.indexOf("'claimant:encrypted-package-delivery:'"));
  assert.ok(migration.indexOf("select * into v_delivery")
    < migration.indexOf("select * into v_case"));
  assert.match(migration, /language plpgsql\s+security invoker\s+set search_path = ''/u);
  assert.match(migration, /v_existing\.request_digest <> v_request_digest/u);
  assert.match(migration, /revoke all on function public\.claimant_close_retrieval_lifecycle\(/u);
  assert.match(migration, /grant execute on function public\.claimant_close_retrieval_lifecycle/u);
});

test("keeps closure immutable-false and unmounted", () => {
  assert.match(service, /CLAIMANT_RETRIEVAL_LIFECYCLE_CLOSURE_APPROVED = false as const/u);
  assert.equal(index.includes("retrieval-lifecycle-closure-service"), false);
  assert.equal(index.includes("retrieval-lifecycle-closure-transaction-client"), false);
});
