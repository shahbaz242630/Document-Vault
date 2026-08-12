const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname,
  "../supabase/migrations/20260813010000_claimant_submission_acknowledgement.sql"), "utf8");
const service = fs.readFileSync(path.resolve(__dirname,
  "../services/api/src/claimant/claim-submission-service.ts"), "utf8");
const apiIndex = fs.readFileSync(path.resolve(__dirname, "../services/api/src/index.ts"), "utf8");

test("creates an append-only forced-RLS safe receipt", () => {
  assert.match(migration, /create table public\.claimant_submission_receipts/);
  assert.match(migration, /foreign key \(case_id, claimant_user_id\)[\s\S]*references public\.claimant_cases/);
  assert.match(migration, /check \(not review_started\)/);
  assert.match(migration, /check \(not release_authorized\)/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /using \(false\) with check \(false\)/);
  assert.match(migration, /grant select, insert on table public\.claimant_submission_receipts to service_role/);
  assert.doesNotMatch(migration, /grant (update|delete).*claimant_submission_receipts/);
});

test("binds submission to server-owned case, portal, key, preparation, and clean evidence authority", () => {
  for (const token of ["claimant_assert_portal_session", "pg_advisory_xact_lock", "for update",
    "status = 'active'", "availability = 'pending'", "max(preparation_version)",
    "capability.status = 'consumed'", "object.status = 'clean'", "state = 'submitted'",
    "claim_submission_received", "submit_claim_for_review"]) assert.ok(migration.includes(token), token);
  assert.match(migration, /v_intake\.status not in \('ready_for_review', 'manual_review'\)/);
  assert.match(migration, /insert into public\.claimant_submission_receipts[\s\S]*insert into public\.claimant_audit_events[\s\S]*insert into public\.claimant_outbox[\s\S]*insert into public\.claimant_idempotency_records/);
});

test("returns only safe acknowledgement state and remains unmounted and disabled", () => {
  assert.match(service, /CLAIMANT_SUBMISSION_APPROVED\s*=\s*false\s+as\s+const/);
  assert.match(migration, /'review_started', false/);
  assert.match(migration, /'release_authorized', false/);
  for (const forbidden of ["reviewer_id", "owner_response", "fraud_signal", "risk_score",
    "internal_note", "filename", "object_path", "content_digest"]) assert.doesNotMatch(service, new RegExp(forbidden));
  assert.doesNotMatch(apiIndex, /claim-submission|submit-claim/);
  assert.doesNotMatch(service, /fetch\(|createClient\(|process\.env/);
});

test("keeps the transaction server-only and security-invoker", () => {
  assert.match(migration, /language plpgsql security invoker set search_path = ''/);
  assert.match(migration, /revoke all on function public\.claimant_submit_claim_for_review[\s\S]*from authenticated/);
  assert.match(migration, /grant execute on function public\.claimant_submit_claim_for_review[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /security definer/);
});
