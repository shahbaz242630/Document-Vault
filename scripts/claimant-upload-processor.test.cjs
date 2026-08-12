const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname,
  "../supabase/migrations/20260813000000_claimant_upload_reconciliation_authority.sql"), "utf8");
const processor = fs.readFileSync(path.resolve(__dirname,
  "../services/api/src/claimant/claimant-upload-processor.ts"), "utf8");
const apiIndex = fs.readFileSync(path.resolve(__dirname, "../services/api/src/index.ts"), "utf8");

test("adds a value-free service-only reconciliation authority", () => {
  assert.match(migration, /create function public\.claimant_get_evidence_upload_reconciliation/);
  assert.match(migration, /capability_digest <> p_capability_digest/);
  assert.match(migration, /'upload_pending'/);
  assert.match(migration, /'upload_uncommitted'/);
  assert.match(migration, /'object_recorded'/);
  assert.match(migration, /revoke all on function public\.claimant_get_evidence_upload_reconciliation/);
  assert.match(migration, /grant execute on function public\.claimant_get_evidence_upload_reconciliation/);
  assert.match(migration, /create function public\.claimant_abandon_evidence_upload/);
  assert.match(migration, /where id = p_object_id for update/);
  assert.match(migration, /set status = 'revoked', revoked_at = now\(\)/);
  assert.match(migration, /grant execute on function public\.claimant_abandon_evidence_upload/);
  assert.doesNotMatch(migration, /security definer|capability_token|content_digest/);
});

test("bounds streamed bytes, chunks, duration and exact object paths", () => {
  assert.match(processor, /CLAIMANT_UPLOAD_MAX_BYTES = 25 \* 1024 \* 1024/);
  assert.match(processor, /CLAIMANT_UPLOAD_MAX_CHUNK_BYTES = 1024 \* 1024/);
  assert.match(processor, /CLAIMANT_UPLOAD_MAX_DURATION_MS = 30_000/);
  assert.match(processor, /observed\.bytes > expectedSize/);
  assert.match(processor, /objectPath !== `v1\/\$\{caseId\}\/\$\{objectId\}`/);
  assert.match(processor, /createHash\("sha256"\)\.update\(token\)/);
});

test("reconciles before ambiguous cleanup and fails scanner errors closed", () => {
  assert.match(processor, /transactions\.reconcile/);
  assert.match(processor, /authority\.authority === "object_recorded"/);
  assert.match(processor, /cleanupOrRequireReconciliation/);
  assert.match(processor, /scanQuarantinedEvidenceV1/);
  assert.match(processor, /"reconciliation_required"/);
});

test("keeps the upload processor hard-disabled and unmounted", () => {
  assert.match(processor, /CLAIMANT_UPLOAD_PROCESSOR_APPROVED\s*=\s*false\s+as\s+const/);
  assert.doesNotMatch(apiIndex, /claimant-upload-processor|evidence-upload/);
  assert.doesNotMatch(processor, /createClient\(|process\.env/);
});
