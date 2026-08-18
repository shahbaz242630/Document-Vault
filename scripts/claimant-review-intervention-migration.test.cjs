const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260818170000_claimant_review_escalation_appeal_foundation.sql"), "utf8");
const service = readFileSync(join(root,
  "services/api/src/claimant/review-intervention-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/review-intervention-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("creates four forced-RLS intervention tables with immutable records and events", () => {
  for (const table of ["claimant_review_resolution_authorities",
    "claimant_review_interventions", "claimant_review_intervention_events",
    "claimant_review_intervention_idempotency"])
    assert.ok(migration.includes(`create table public.${table}`), table);
  assert.equal((migration.match(/force row level security/g) ?? []).length, 4);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 4);
  assert.doesNotMatch(migration, /grant[^;]*(update|delete)[^;]*claimant_review_interventions/);
  assert.doesNotMatch(migration,
    /grant[^;]*(update|delete)[^;]*claimant_review_intervention_events/);
  for (const index of ["claimant_review_interventions_case_idx",
    "claimant_review_interventions_cycle_case_idx",
    "claimant_review_interventions_authority_idx",
    "claimant_review_intervention_events_intervention_case_idx",
    "claimant_review_intervention_events_authority_idx",
    "claimant_review_intervention_idempotency_authority_idx"])
    assert.ok(migration.includes(`create index ${index}`), index);
});
test("uses separate synthetic authority and rejects case-party or reviewer overlap", () => {
  for (const token of ["synthetic_resolution_authority_", "live_resolution_authority",
    "v_authority.user_id in (v_case.owner_user_id, v_case.claimant_user_id)",
    "from public.claimant_reviewer_identities reviewer",
    "v_authority.authority_class <> 'escalation_test_operator'",
    "v_authority.authority_class <> 'appeal_test_operator'"])
    assert.ok(migration.includes(token), token);
});
test("atomically holds the round and invalidates approval without advancing the case", () => {
  assert.match(migration, /update public\.claimant_review_rounds set status = 'held'/);
  assert.match(migration, /two_person_approval_satisfied = false, release_authorized = false/);
  assert.match(migration, /round_version = round_version \+ 1/);
  assert.doesNotMatch(migration, /update public\.claimant_cases set state/);
  assert.match(migration, /'release_authorized', false/);
  assert.match(migration, /p_intervention_type = 'appeal'[\s\S]*v_round\.status not in \('rejected', 'held'\)/);
});
test("keeps the security-invoker service literal-false and unmounted", () => {
  assert.match(migration, /language plpgsql security invoker set search_path = ''/);
  assert.doesNotMatch(migration, /security definer/);
  assert.match(migration, /revoke all on function public\.claimant_open_review_intervention[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.claimant_open_review_intervention[\s\S]*to service_role/);
  assert.match(service, /CLAIMANT_REVIEW_INTERVENTION_APPROVED\s*=\s*false\s+as\s+const/);
  assert.doesNotMatch(index, /review-intervention-service|review-intervention-transaction-client/);
});
test("returns no authority identity, reason, decision, evidence, or resolution detail", () => {
  const resultType = client.slice(client.indexOf("export type ReviewInterventionResultV1"),
    client.indexOf("export type ReviewInterventionTransactionClientV1"));
  assert.doesNotMatch(resultType, /authorityIdentityId|reasonClass|decision|resolution/);
  for (const source of [service, client]) for (const token of ["fetch(", "process.env",
    "localStorage", "document.", "window.", "evidence_bytes", "signed_url",
    "release_package", "authorize_release", "sendEmail", "resend", "postmark", "twilio"])
    assert.ok(!source.includes(token), token);
});
