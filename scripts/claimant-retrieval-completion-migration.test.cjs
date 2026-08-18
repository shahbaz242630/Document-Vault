const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260818230000_claimant_retrieval_completion.sql"), "utf8");
const service = readFileSync(join(root,
  "services/api/src/claimant/retrieval-completion-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/retrieval-completion-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("creates three forced-RLS retrieval-completion tables with indexed foreign keys", () => {
  for (const table of ["claimant_retrieval_completions",
    "claimant_retrieval_completion_events", "claimant_retrieval_completion_idempotency"])
    assert.ok(migration.includes(`create table public.${table}`), table);
  assert.equal((migration.match(/force row level security/g) ?? []).length, 3);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 3);
  assert.ok((migration.match(/create index claimant_retrieval_completion/g) ?? []).length >= 9);
});

test("requires exact served delivery, active portal, manifest, claimant key and App Attest key", () => {
  for (const token of ["v_delivery.status <> 'served'", "not v_delivery.package_served",
    "v_session.status <> 'consumed_served'", "v_portal.status <> 'active'",
    "v_portal.active_session_id <> p_portal_session_id", "v_portal.assurance_level <> 'aal2'",
    "identity.status = 'active'", "eligibility.status = 'eligible'",
    "v_manifest.manifest_digest <> p_manifest_digest", "device_key.status = 'active'",
    "case_key.status = 'active'", "v_app_key.status <> 'active'",
    "v_app_key.assertion_counter <> p_expected_previous_counter"])
    assert.ok(migration.includes(token), token);
});

test("binds the value-free native-open proof and rejects stale or future opening", () => {
  for (const token of ["'sanduqkin:claim:native-open-proof:v1'",
    "p_verified_proof_digest <> v_expected_proof_digest",
    "p_verified_counter <= v_app_key.assertion_counter",
    "p_opened_at < v_delivery.served_at - interval '1 second'",
    "p_opened_at > v_now + interval '1 minute'", "p_opened_at > v_session.expires_at",
    "p_native_open_session_digest"])
    assert.ok(migration.includes(token), token);
  assert.match(service, /sha256\(proof\.nativeOpenSessionReference\)/u);
  assert.match(service, /String\(proof\.exportPerformed\)/u);
});

test("atomically advances App Attest and marks only retrieval completion", () => {
  for (const token of ["assertion_counter = p_verified_counter",
    "insert into public.claimant_app_attest_events",
    "insert into public.claimant_retrieval_completions",
    "set retrieval_completed = true", "status = 'completed_opened'",
    "'retrieval_completed', true", "'export_performed', false", "'closure_recorded', false"])
    assert.ok(migration.includes(token), token);
  assert.doesNotMatch(migration, /update public\.claimant_cases set/u);
});

test("uses one service-only security-invoker function and safe idempotency", () => {
  assert.match(migration, /language plpgsql\s+security invoker\s+set search_path = ''/u);
  assert.match(migration,
    /revoke all on function public\.claimant_complete_verified_native_open\([\s\S]*from public, anon, authenticated;/u);
  assert.match(migration, /grant execute on function public\.claimant_complete_verified_native_open/u);
  assert.match(migration, /v_existing\.request_digest <> v_request_digest/u);
});

test("keeps the proof verifier and transaction unmounted behind literal false", () => {
  assert.match(service, /CLAIMANT_RETRIEVAL_COMPLETION_APPROVED = false as const/u);
  assert.match(service, /await input\.proofVerifier\.verify/u);
  assert.match(client, /retrieval_completed: z\.literal\(true\)/u);
  assert.match(client, /export_performed: z\.literal\(false\)/u);
  assert.match(client, /closure_recorded: z\.literal\(false\)/u);
  assert.equal(index.includes("retrieval-completion-service"), false);
  assert.equal(index.includes("retrieval-completion-transaction-client"), false);
});
