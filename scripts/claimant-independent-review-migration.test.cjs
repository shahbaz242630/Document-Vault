const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const root = join(__dirname, "..");
const migration = readFileSync(join(root, "supabase/migrations/20260818160000_claimant_independent_review_foundation.sql"), "utf8");
const service = readFileSync(join(root, "services/api/src/claimant/independent-review-service.ts"), "utf8");
const client = readFileSync(join(root, "services/api/src/claimant/independent-review-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("creates four forced-RLS review tables with append-only decisions and events", () => {
  for (const table of ["claimant_review_rounds", "claimant_review_decisions",
    "claimant_review_events", "claimant_review_idempotency"])
    assert.ok(migration.includes(`create table public.${table}`), table);
  assert.equal((migration.match(/force row level security/g) ?? []).length, 4);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 4);
  assert.doesNotMatch(migration, /grant[^;]*(update|delete)[^;]*claimant_review_decisions/);
  assert.doesNotMatch(migration, /grant[^;]*(update|delete)[^;]*claimant_review_events/);
});
test("binds reviews to current assignment, submission, policy, checklist, and clean evidence", () => {
  for (const token of ["v_assignment.status <> 'assigned'",
    "v_assignment.assignment_version <> p_expected_assignment_version",
    "reviewer.status = 'active'", "not reviewer.live_review_authority",
    "v_receipt.case_version <> p_expected_submission_case_version",
    "v_intake.version <> p_expected_intake_version", "v_case.policy_pack_id <> p_policy_pack_id",
    "availability = 'pending'", "object.status = 'clean'", "object.version::text",
    "v_evidence_digest <> p_evidence_manifest_digest"])
    assert.ok(migration.includes(token), token);
  assert.match(migration, /assignment\.assignment_version <> decision\.assignment_version/);
});
test("enforces blind distinct decisions and two-allow approval without release", () => {
  assert.match(migration, /unique \(review_round_id, assignment_slot\)/);
  assert.match(migration, /unique \(review_round_id, reviewer_identity_id\)/);
  assert.match(migration, /v_allow_count = 2 then 'two_person_approved'/);
  assert.match(migration, /'release_authorized', false/);
  assert.match(migration, /release_authorized boolean not null default false check \(not release_authorized\)/);
  assert.doesNotMatch(migration, /update public\.claimant_cases set state/);
  const resultType = client.slice(client.indexOf("export type IndependentReviewResultV1"),
    client.indexOf("export type IndependentReviewTransactionClientV1"));
  assert.doesNotMatch(resultType, /decision|reasonClass|reviewerIdentityId/);
});
test("keeps the security-invoker service literal-false and unmounted", () => {
  assert.match(migration, /language plpgsql security invoker set search_path = ''/);
  assert.doesNotMatch(migration, /security definer/);
  assert.match(migration, /revoke all on function public\.claimant_record_independent_review[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.claimant_record_independent_review[\s\S]*to service_role/);
  assert.match(service, /CLAIMANT_INDEPENDENT_REVIEW_APPROVED\s*=\s*false\s+as\s+const/);
  assert.doesNotMatch(index, /independent-review-service|independent-review-transaction-client/);
});
test("contains no UI, evidence access, provider, package, or release implementation", () => {
  for (const source of [service, client]) for (const token of ["fetch(", "process.env",
    "localStorage", "document.", "window.", "evidence_bytes", "signed_url", "release_package",
    "authorize_release", "sendEmail", "resend", "postmark", "twilio"])
    assert.ok(!source.includes(token), token);
});
