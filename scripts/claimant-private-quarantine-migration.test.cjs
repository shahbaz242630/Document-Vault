const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname,
  "../supabase/migrations/20260812230000_claimant_private_evidence_quarantine.sql"), "utf8");
const service = fs.readFileSync(path.resolve(__dirname,
  "../services/api/src/claimant/private-quarantine-service.ts"), "utf8");
const apiIndex = fs.readFileSync(path.resolve(__dirname, "../services/api/src/index.ts"), "utf8");

test("creates one private bounded quarantine bucket with deny-all client policies", () => {
  assert.match(migration, /claimant-evidence-quarantine-v1/);
  assert.match(migration, /public, file_size_limit, allowed_mime_types/);
  assert.match(migration, /false, 26214400/);
  for (const media of ["application/pdf", "image/jpeg", "image/png"]) assert.match(migration, new RegExp(media));
  assert.match(migration, /on storage\.objects as restrictive for all to anon/);
  assert.match(migration, /on storage\.objects as restrictive for all to authenticated/);
  assert.equal((migration.match(/bucket_id <> 'claimant-evidence-quarantine-v1'/g) ?? []).length, 4);
  assert.doesNotMatch(migration, /createSignedUploadUrl|signedUrl|public\s*=\s*true/);
});

test("stores only digested five-minute capabilities with randomized case-bound paths", () => {
  assert.match(migration, /create table public\.claimant_evidence_upload_capabilities/);
  assert.match(migration, /capability_digest text not null unique/);
  assert.match(migration, /expires_at <= issued_at \+ interval '5 minutes'/);
  assert.match(migration, /object_path = 'v1\/' \|\| case_id::text \|\| '\/' \|\| id::text/);
  assert.match(service, /createHmac\("sha256", input\.capabilityDerivationKey\)/);
  assert.match(service, /createHash\("sha256"\)/);
  assert.doesNotMatch(migration, /capability_token|raw_secret|signed_url/);
});

test("enforces quarantine, scanning, retention and deletion lifecycle limits", () => {
  assert.match(migration, /create table public\.claimant_evidence_objects/);
  assert.match(migration, /size_bytes between 1 and 26214400/);
  assert.match(migration, /page_count between 1 and 50/);
  assert.match(migration, /expanded_size_bytes between 1 and 104857600/);
  assert.match(migration, /archive_entry_count = 1/);
  assert.match(migration, /synthetic_retention_30d_v1/);
  assert.match(migration, /v_object\.legal_hold or v_object\.delete_after > now\(\)/);
  for (const name of ["claimant_issue_evidence_upload_capability", "claimant_record_evidence_quarantine",
    "claimant_record_evidence_scan", "claimant_plan_evidence_deletion",
    "claimant_confirm_evidence_deleted"]) {
    assert.match(migration, new RegExp(`create function public\\.${name}`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}`));
  }
  assert.doesNotMatch(migration, /security definer/);
});

test("keeps quarantine hard-disabled, unmounted and server mediated", () => {
  assert.match(service, /CLAIMANT_PRIVATE_QUARANTINE_APPROVED\s*=\s*false\s+as\s+const/);
  assert.doesNotMatch(apiIndex, /private-quarantine|evidence-upload/);
  assert.doesNotMatch(service, /fetch\(|createClient\(|process\.env/);
});
