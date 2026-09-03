const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260818220000_claimant_encrypted_package_delivery.sql"), "utf8");
const coordinator = readFileSync(join(root,
  "services/api/src/claimant/encrypted-package-delivery-coordinator.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/encrypted-package-delivery-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("creates forced-RLS encrypted-delivery records with explicit indexes", () => {
  for (const table of ["claimant_encrypted_package_deliveries",
    "claimant_encrypted_package_delivery_events",
    "claimant_encrypted_package_delivery_idempotency"])
    assert.ok(migration.includes(`create table public.${table}`), table);
  assert.equal((migration.match(/force row level security/g) ?? []).length, 3);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 3);
  assert.ok((migration.match(/create index claimant_encrypted_package_/g) ?? []).length >= 9);
});

test("consumes the exact live retrieval authority and revalidates release inputs", () => {
  for (const token of ["v_session.status <> 'authorized_unserved'",
    "v_session.expires_at <= v_started_at", "v_portal.status <> 'active'",
    "v_portal.active_session_id <> v_session.portal_session_id",
    "v_portal.assurance_level <> 'aal2'", "v_case.state = 'release_ready'",
    "v_finalization.status <> 'finalized_release_ready'",
    "v_source_grant.status <> 'active'", "case_key.status = 'active'",
    "device_key.status = 'active'", "signing_key.status <> 'compromised'",
    "from public.claimant_review_interventions intervention"])
    assert.ok(migration.includes(token), token);
});

test("returns an exact encrypted package without plaintext or bearer delivery URLs", () => {
  for (const token of ["'protocol', 'sanduqkin:claim:encrypted-delivery:v1'",
    "'assets', v_assets", "'ciphertext', v_source_grant.ciphertext",
    "'canonical_manifest', v_manifest.canonical_manifest",
    "'detached_signature', v_manifest.detached_signature"])
    assert.ok(migration.includes(token), token);
  const payload = migration.slice(migration.indexOf("v_payload := jsonb_build_object"),
    migration.indexOf("v_payload_text := v_payload::text"));
  for (const token of ["plaintext", "signed_url", "access_token", "refresh_token",
    "private_key", "decrypt("])
    assert.equal(payload.toLowerCase().includes(token), false, token);
  assert.match(client, /createHash\("sha256"\)/u);
  assert.match(client, /Buffer\.byteLength\(parsed\.data\.delivery_payload, "utf8"\)/u);
});

test("records served truth only after an exact verified completion receipt", () => {
  for (const token of ["v_delivery.payload_digest <> p_payload_digest",
    "v_delivery.payload_bytes <> p_payload_bytes", "p_completed_at > v_delivery.lease_expires_at",
    "p_receipt_digest <> v_expected_receipt_digest", "status = 'served'",
    "package_served = true", "'retrieval_completed', false",
    "state = 'released'", "version = version + 1"])
    assert.ok(migration.includes(token), token);
  assert.match(coordinator, /adapter\.lookup\(/u);
  assert.match(coordinator, /lookup\.status !== "verified"/u);
  assert.match(coordinator, /lookup\.payloadDigest !== prepared\.payloadDigest/u);
  assert.match(migration, /v_session\.status = 'consumed_served'[\s\S]*v_case\.state = 'released'/u);
});

test("uses service-only security-invoker RPCs and remains disabled and unmounted", () => {
  assert.equal((migration.match(/security invoker/g) ?? []).length, 2);
  assert.equal((migration.match(/revoke all on function public\.claimant_/g) ?? []).length, 2);
  assert.match(coordinator,
    /CLAIMANT_ENCRYPTED_PACKAGE_DELIVERY_APPROVED = false as const/u);
  assert.equal(index.includes("encrypted-package-delivery-coordinator"), false);
  assert.equal(index.includes("encrypted-package-delivery-transaction-client"), false);
});
