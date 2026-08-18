const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const root = join(__dirname, "..");
const migration = readFileSync(join(root,
  "supabase/migrations/20260818200000_claimant_signed_manifest_foundation.sql"), "utf8");
const service = readFileSync(join(root,
  "services/api/src/claimant/signed-manifest-service.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/signed-manifest-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

test("creates six forced-RLS signing and finalization tables", () => {
  for (const table of ["claimant_release_signing_authorities",
    "claimant_release_signing_keys", "claimant_release_package_finalizations",
    "claimant_release_signed_manifests", "claimant_release_package_finalization_events",
    "claimant_release_package_finalization_idempotency"])
    assert.ok(migration.includes(`create table public.${table}`), table);
  assert.equal((migration.match(/force row level security/g) ?? []).length, 6);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 6);
});
test("uses distinct synthetic signing authority and current Ed25519 key", () => {
  for (const token of ["v_signing_authority.status <> 'active'",
    "v_signing_authority.live_signing_authority", "v_signing_key.status <> 'active'",
    "v_signing_key.signature_algorithm <> 'ed25519'",
    "v_signing_key.key_version <> p_expected_signing_key_version",
    "v_signing_key.public_key_digest <> p_verified_public_key_digest",
    "v_signing_authority.user_id in (v_case.owner_user_id, v_case.claimant_user_id",
    "from public.claimant_reviewer_identities reviewer",
    "from public.claimant_review_resolution_authorities resolution"])
    assert.ok(migration.includes(token), token);
});
test("revalidates exact package, authorization, assets, grants, and intervention state", () => {
  for (const token of ["v_case.state <> 'approved'", "v_package.status <> 'prepared_unsigned'",
    "v_package.expires_at <= v_finalized_at", "v_authorization.status <> 'authorized'",
    "from public.claimant_review_interventions intervention",
    "asset.ciphertext <> package_asset.ciphertext",
    "v_grant.sealed_grant_digest <> encode(extensions.digest(concat_ws('|',",
    "v_manifest_count <> v_package.grant_count"])
    assert.ok(migration.includes(token), token);
});
test("binds every frozen canonical manifest in grant order", () => {
  for (const token of ["v_manifest -> 'asset_ciphertext_digests' <> v_expected_asset_digests",
    "v_manifest ->> 'signing_key_id' <> v_signing_key.signing_key_id",
    "v_release_material ->> 'profile' <> 'registered_recipient_v1'",
    "v_release_material ->> 'sealed_grant_digest' <> v_expected_grant_digest",
    "v_manifest_set_digest := encode(extensions.digest(concat_ws('|',",
    "v_package.preparation_manifest_digest"])
    assert.ok(migration.includes(token), token);
  assert.match(service, /verify\(null, Buffer\.from\(message, "utf8"\)/u);
  assert.match(service, /canonicalJson\(signed\.manifest\)/u);
});
test("advances only approved to release-ready and leaves retrieval false", () => {
  assert.match(migration, /update public\.claimant_cases set state = 'release_ready'/u);
  assert.match(migration, /where id = p_case_id and state = 'approved'/u);
  assert.match(migration, /retrieval_authorized boolean not null default false check \(not retrieval_authorized\)/u);
  assert.match(migration, /'manifest_signed', true,[\s\S]*'retrieval_authorized', false/u);
  assert.doesNotMatch(migration, /state = 'released'/u);
});
test("keeps security invoker, explicit service grants, indexes, and no mounted route", () => {
  assert.match(migration, /language plpgsql security invoker set search_path = ''/u);
  assert.match(migration,
    /revoke all on function public\.claimant_finalize_signed_release_package\([\s\S]*from public, anon, authenticated;/u);
  assert.ok((migration.match(/create index claimant_release_/g) ?? []).length >= 9);
  assert.equal(index.includes("signed-manifest-service"), false);
  assert.match(service, /CLAIMANT_SIGNED_MANIFEST_APPROVED = false as const/u);
});
test("returns no signing key, signature, manifest, party, grant, or asset detail", () => {
  const result = migration.slice(migration.indexOf("v_result := jsonb_build_object"),
    migration.indexOf("insert into public.claimant_release_package_finalization_idempotency"));
  for (const token of ["public_key", "signature", "manifest_digest", "owner_user_id",
    "claimant_user_id", "grant_id", "asset_id"])
    assert.equal(result.includes(`'${token}'`), false, token);
  assert.match(client, /retrieval_authorized: z\.literal\(false\)/u);
});
