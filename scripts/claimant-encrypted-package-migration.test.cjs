const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260818190000_claimant_encrypted_package_foundation.sql"), "utf8");
const service = readFileSync(join(root,
  "services/api/src/claimant/encrypted-package-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/encrypted-package-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("creates five forced-RLS immutable package tables", () => {
  for (const table of ["claimant_release_packages", "claimant_release_package_assets",
    "claimant_release_package_grants", "claimant_release_package_events",
    "claimant_release_package_idempotency"])
    assert.ok(migration.includes(`create table public.${table}`), table);
  assert.equal((migration.match(/force row level security/g) ?? []).length, 5);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 5);
  for (const table of ["claimant_release_packages", "claimant_release_package_assets",
    "claimant_release_package_grants", "claimant_release_package_events"])
    assert.match(migration, new RegExp(
      `grant select, insert on table public\\.${table} to service_role;`
    ));
});
test("binds preparation to current authorization, cycle, review, and no intervention", () => {
  assert.doesNotMatch(migration,
    /from public\.claimant_release_authorizations[^;]*for update/);
  assert.match(migration, /from public\.claimant_cases where id = p_case_id for update;/);
  for (const token of ["v_case.state <> 'approved'",
    "v_authorization.authorized_case_version <> p_expected_case_version",
    "v_authorization.status <> 'authorized'", "not v_authorization.release_authorized",
    "v_authorization.package_creation_authorized", "v_authorization.retrieval_authorized",
    "v_cycle.status <> 'delivery_verified'", "v_round.status <> 'two_person_approved'",
    "not v_round.two_person_approval_satisfied",
    "from public.claimant_review_interventions intervention"])
    assert.ok(migration.includes(token), token);
});
test("copies only exact current owner ciphertext and every active current grant", () => {
  for (const token of ["from public.vault_assets", "user_id = p_owner_user_id",
    "deleted_at is null for update", "v_asset.ciphertext <> v_entry.value ->> 'ciphertext'",
    "v_asset.nonce <> v_entry.value ->> 'nonce'", "v_total_ciphertext_length > 10485760",
    "v_active_grant_count <> v_grant_count", "grant_record.status = 'active'",
    "grant_record.recipient_key_version = device_key.key_version",
    "v_grant_digest <> v_entry.value ->> 'sealed_grant_digest'"])
    assert.ok(migration.includes(token), token);
  assert.match(migration, /unique \(package_id, source_asset_id\)/);
  assert.match(migration, /unique \(package_id, grant_id\)/);
  assert.match(migration, /unique \(package_id, recipient_key_id\)/);
});
test("keeps the package unsigned, non-retrievable, and case approved", () => {
  assert.match(migration, /status text not null default 'prepared_unsigned'/);
  assert.match(migration, /manifest_signed boolean not null default false check \(not manifest_signed\)/);
  assert.match(migration, /retrieval_authorized boolean not null default false check \(not retrieval_authorized\)/);
  assert.match(migration, /'manifest_signed', false, 'retrieval_authorized', false/);
  assert.doesNotMatch(migration, /update public\.claimant_cases/);
  for (const token of ["decrypt", "private_key", "plaintext", "signed_url", "retrieval_session"])
    assert.ok(!migration.includes(token), token);
});
test("uses security-invoker, explicit grants, indexes, and an unmounted false gate", () => {
  assert.match(migration, /language plpgsql security invoker set search_path = ''/);
  assert.doesNotMatch(migration, /security definer/);
  assert.match(migration, /revoke all on function public\.claimant_prepare_encrypted_release_package[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.claimant_prepare_encrypted_release_package[\s\S]*to service_role/);
  assert.equal((migration.match(/create index claimant_release_/g) ?? []).length, 9);
  assert.match(service, /CLAIMANT_ENCRYPTED_PACKAGE_APPROVED\s*=\s*false\s+as\s+const/);
  assert.doesNotMatch(index, /encrypted-package-service|encrypted-package-transaction-client/);
});
test("returns no ciphertext, nonce, digest, grant, asset, owner, or claimant detail", () => {
  const resultType = client.slice(client.indexOf("export type EncryptedPackageResultV1"),
    client.indexOf("export type EncryptedPackageTransactionClientV1"));
  assert.doesNotMatch(resultType, /ciphertext|nonce|digest|grantId|assetId|ownerUserId|claimant/);
});
