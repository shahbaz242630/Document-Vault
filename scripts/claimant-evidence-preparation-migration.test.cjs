const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname,
  "../supabase/migrations/20260812220000_claimant_evidence_preparation_metadata.sql"), "utf8");
const service = fs.readFileSync(path.resolve(__dirname,
  "../services/api/src/claimant/claim-evidence-preparation-service.ts"), "utf8");
const apiIndex = fs.readFileSync(path.resolve(__dirname, "../services/api/src/index.ts"), "utf8");

test("creates append-only, forced-RLS preparation metadata storage", () => {
  assert.match(migration, /create table public\.claimant_evidence_preparation_items/);
  assert.match(migration, /primary key \(case_id, preparation_version, item_key\)/);
  assert.match(migration, /foreign key \(case_id, item_key\)[\s\S]*claimant_checklist_items/);
  assert.match(migration, /foreign key \(case_id, claimant_user_id, policy_pack_id, policy_pack_version\)/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /using \(false\) with check \(false\)/);
  assert.match(migration, /grant select, insert on table public\.claimant_evidence_preparation_items to service_role/);
  assert.doesNotMatch(migration, /grant (update|delete).*claimant_evidence_preparation_items/);
  assert.doesNotMatch(migration, /grant .* to authenticated/);
  assert.doesNotMatch(migration, /security definer/);
});

test("stores metadata only and never claims upload, scanning, or review readiness", () => {
  for (const allowed of ["placeholder_ref", "media_type", "size_bytes", "claimed_prepared_at",
    "not_available", "synthetic_only"]) assert.match(migration, new RegExp(allowed));
  for (const prohibited of ["filename", "object_path", "bucket", "document_body", "identity_number",
    "checksum", "malware_status", "scan_status", "ready_for_review", "upload_received"]) {
    assert.doesNotMatch(migration, new RegExp(prohibited));
  }
  assert.match(migration, /availability = 'pending'/);
  assert.match(migration, /availability = 'not_available'/);
  assert.match(migration, /v_case\.state <> 'identity_pending'/);
  assert.doesNotMatch(migration, /update public\.claimant_cases set state/);
});

test("records one locked, versioned and idempotent server-only transaction", () => {
  assert.match(migration, /create function public\.claimant_record_evidence_preparation/);
  assert.match(migration, /claimant_assert_portal_session\(p_claimant_user_id, p_portal_session_id\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /where id = p_case_id for update/);
  assert.match(migration, /where case_id = p_case_id for update/);
  assert.match(migration, /'record_evidence_preparation'/);
  assert.match(migration, /'evidence_preparation_recorded'/);
  assert.match(migration, /revoke all on function public\.claimant_record_evidence_preparation/);
  assert.match(migration, /grant execute on function public\.claimant_record_evidence_preparation/);
});

test("keeps evidence preparation hard-disabled and unmounted", () => {
  assert.match(service, /CLAIMANT_EVIDENCE_PREPARATION_APPROVED\s*=\s*false\s+as\s+const/);
  assert.doesNotMatch(apiIndex,
    /evidence-preparation-service|claimant_record_evidence_preparation|createEvidencePreparation/);
  assert.doesNotMatch(service, /fetch\(|createClient\(|process\.env/);
});
