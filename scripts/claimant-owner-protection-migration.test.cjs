const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const migration = readFileSync(join(root, "supabase", "migrations",
  "20260818010000_claimant_owner_protection_foundation.sql"), "utf8");
const service = readFileSync(join(root, "services", "api", "src", "claimant",
  "owner-protection-service.ts"), "utf8");
const client = readFileSync(join(root, "services", "api", "src", "claimant",
  "owner-protection-transaction-client.ts"), "utf8");
const apiIndex = readFileSync(join(root, "services", "api", "src", "index.ts"), "utf8");

test("creates default-deny owner-protection control, event, and idempotency tables", () => {
  for (const table of ["claimant_owner_protection_cycles", "claimant_owner_protection_events",
    "claimant_owner_protection_idempotency"]) {
    assert.ok(migration.includes(`create table public.${table}`), table);
  }
  assert.equal((migration.match(/force row level security/g) ?? []).length, 3);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 3);
  assert.match(migration, /grant select, insert on table public\.claimant_owner_protection_events/);
  assert.doesNotMatch(migration, /grant[^;]*(update|delete)[^;]*claimant_owner_protection_events/);
  assert.doesNotMatch(migration, /grant[^;]*(update|delete)[^;]*claimant_owner_protection_idempotency/);
});

test("starts cooldown only from verified delivery and fails uncertainty to hold", () => {
  assert.match(migration, /p_outcome = 'verified'[\s\S]*delivery_verified_at = now\(\)[\s\S]*cooldown_started_at = now\(\)[\s\S]*state = 'cooldown'/);
  assert.match(migration, /p_outcome <> 'verified'[\s\S]*p_delivery_evidence_digest is not null/);
  assert.match(migration, /status = 'delivery_' \|\| p_outcome[\s\S]*state = 'on_hold'/);
  assert.match(migration, /state <> 'submitted'[\s\S]*claimant_submission_receipts/);
  for (const token of ["owner_cancelled", "claimant_dispute", "material_change",
    "conflicting_authority", "cancelled_by_owner", "release_authorized', false",
    "review_started', false"]) assert.ok(migration.includes(token), token);
});

test("keeps all transactions service-only, security-invoker, and unmounted", () => {
  assert.equal((migration.match(/language plpgsql security invoker set search_path = ''/g) ?? []).length, 3);
  for (const fn of ["claimant_begin_owner_notice", "claimant_record_owner_notice_delivery",
    "claimant_stop_owner_protection"]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*from public, anon, authenticated`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*to service_role`));
  }
  assert.doesNotMatch(migration, /security definer/);
  assert.match(service, /CLAIMANT_OWNER_PROTECTION_APPROVED\s*=\s*false\s+as\s+const/);
  assert.doesNotMatch(apiIndex, /owner-protection-service|owner-protection-transaction-client/);
});

test("keeps value-free events and contains no provider or release implementation", () => {
  for (const token of ["email_address", "phone_number", "recipient_address", "message_body",
    "sendEmail", "resend", "postmark", "mailgun", "twilio", "reviewer_id", "owner_response",
    "release_package", "private_key"]) {
    assert.doesNotMatch(migration, new RegExp(token));
    assert.doesNotMatch(service, new RegExp(token));
  }
  assert.doesNotMatch(service, /fetch\(|createClient\(|process\.env/);
  assert.match(client, /release_authorized: z\.literal\(false\)/);
  assert.match(client, /review_started: z\.literal\(false\)/);
});
