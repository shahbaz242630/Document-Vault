const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname,
  "../supabase/migrations/20260812210000_claimant_intake_checklist_foundation.sql"), "utf8");
const service = fs.readFileSync(path.resolve(__dirname,
  "../services/api/src/claimant/claim-intake-service.ts"), "utf8");
const apiIndex = fs.readFileSync(path.resolve(__dirname, "../services/api/src/index.ts"), "utf8");

test("creates bounded forced-RLS intake and checklist storage", () => {
  for (const table of ["claimant_intake_snapshots", "claimant_checklist_items"]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
  assert.equal((migration.match(/force row level security/g) ?? []).length, 2);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 2);
  assert.match(migration, /claimant_cases_intake_binding_unique/);
  assert.match(migration, /foreign key \(case_id, claimant_user_id, policy_pack_id, policy_pack_version\)/);
  assert.match(migration, /routing_conditions - 'probate_required'[\s\S]*= '\{\}'::jsonb/);
  assert.doesNotMatch(migration, /grant .* to authenticated/);
  assert.doesNotMatch(migration, /security definer/);
  for (const prohibited of ["document_body", "filename", "identity_number", "reviewer_identity",
    "owner_response", "fraud_signal", "release_predicate"]) assert.doesNotMatch(migration, new RegExp(prohibited));
});

test("initializes intake through one locked server-only transition", () => {
  assert.match(migration, /create function public\.claimant_initialize_claim_intake/);
  assert.match(migration, /claimant_assert_portal_session\(p_claimant_user_id, p_portal_session_id\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /where id = p_case_id for update/);
  assert.match(migration, /state = 'identity_pending', version = version \+ 1/);
  assert.match(migration, /'claim_intake_initialized'/);
  assert.match(migration, /'initialize_claim_intake'/);
  assert.match(migration, /revoke all on function public\.claimant_initialize_claim_intake/);
  assert.match(migration, /grant execute on function public\.claimant_initialize_claim_intake/);
});

test("requires the complete common checklist and exact bounded routing facts", () => {
  for (const item of ["claimant_photo_identity", "identity_verification_result", "owner_match_reference",
    "official_death_record", "authority_basis", "processing_declaration", "conflict_declaration"]) {
    assert.match(migration, new RegExp(`'${item}'`));
  }
  assert.match(migration, /v_common_count <> 7/);
  assert.match(migration, /v_key_count <> 6/);
  assert.match(migration, /jsonb_typeof\(value\) <> 'boolean'/);
  assert.match(migration, /availability' <> 'pending'/);
});

test("keeps intake initialization hard-disabled and unmounted", () => {
  assert.match(service, /CLAIMANT_INTAKE_INITIALIZATION_APPROVED\s*=\s*false\s+as\s+const/);
  assert.doesNotMatch(apiIndex, /claim-intake|claimant\/intake/);
  assert.doesNotMatch(service, /fetch\(|createClient\(|process\.env/);
});
