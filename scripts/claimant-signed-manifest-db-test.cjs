const { execFileSync } = require("node:child_process");
const { createHash, randomUUID } = require("node:crypto");
const { Buffer } = require("node:buffer");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { standaloneSchema: encryptedPackageSchema, buildClaimantEncryptedPackageDbTestSql } =
  require("./claimant-encrypted-package-db-test.cjs");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const migration = readFileSync(join(__dirname,
  "../supabase/migrations/20260818200000_claimant_signed_manifest_foundation.sql"),
"utf8");
function standaloneSchema() { return `${encryptedPackageSchema()}
alter table public.claimant_cases add column updated_at timestamptz not null default now();
alter table public.claimant_owner_protection_cycles add column cycle_number integer not null default 1;
alter table public.claimant_release_authority_identities add column user_id uuid;
create table public.claimant_reviewer_identities(id uuid primary key, user_id uuid not null);
create table public.claimant_review_resolution_authorities(id uuid primary key, user_id uuid not null);
grant all on public.claimant_reviewer_identities,
  public.claimant_review_resolution_authorities to service_role;
${migration}`; }

function buildClaimantSignedManifestDbTestSql(options = {}) {
  const names = ["case", "cycle", "round", "authorization", "releaseAuthority",
    "releaseAuthorityUser", "signingAuthority", "signingUser", "signingKey", "owner",
    "claimant", "key1", "key2", "grant1", "grant2", "asset", "package",
    "finalization", "manifest1", "manifest2", "first", "changed", "hostile",
    "intervention"];
  const id = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  const preparedAt = new Date(Date.now() - 120000).toISOString();
  const snapshotAt = new Date(Date.parse(preparedAt) - 60000).toISOString();
  const expiresAt = new Date(Date.parse(preparedAt) + 72 * 60 * 60 * 1000).toISOString();
  const ciphertext = b64("synthetic encrypted vault envelope 01");
  const assetNonce = b64("synthetic vault nonce 01");
  const signingPublicKey = b64("synthetic-ed25519-public-key-001");
  const signingPublicKeyDigest = sha256hex(Buffer.from(signingPublicKey, "base64url"));
  const grants = [
    { id: id.grant1, key: id.key1, cipher: "G".repeat(64),
      nonce: "N".repeat(32), ephemeral: "E".repeat(87) },
    { id: id.grant2, key: id.key2, cipher: "H".repeat(64),
      nonce: "M".repeat(32), ephemeral: "F".repeat(87) },
  ];
  const common = { asset_ciphertext_digests: [sha256b64(Buffer.from(ciphertext, "base64url"))],
    asset_snapshot_boundary: snapshotAt, cancellation_version: 1,
    claim_id: id.case, claim_version: 6, claimant_id: id.claimant,
    created_at: preparedAt, expires_at: expiresAt,
    owner_id: id.owner, policy_decision_version: 1,
    protocol: "sanduqkin:claim:release-package:v1", release_package_id: id.package,
    signing_key_id: "claim-release-signing-synthetic-v1" };
  const signatureVerifiedAt = new Date().toISOString();
  const entries = grants.map((grant, index) => { const canonical = canonicalJson({ ...common,
    release_material: { grant_id: grant.id, grant_version: 1,
      profile: "registered_recipient_v1", recipient_id: id.claimant,
      recipient_key_id: grant.key, recipient_key_version: 1,
      sealed_grant_digest: sha256b64(Buffer.from(grant.cipher, "base64url")) } });
    return { canonical_manifest: canonical, detached_signature: "S".repeat(86),
      grant_id: grant.id, manifest_digest: sha256hex(canonical),
      manifest_id: index ? id.manifest2 : id.manifest1,
      signature_verified_at: signatureVerifiedAt }; });
  const manifests = sqlJson(entries);
  const standaloneFixture = `insert into auth.users(id) values ('${id.owner}'), ('${id.claimant}'),
  ('${id.releaseAuthorityUser}'), ('${id.signingUser}');
insert into public.claimant_identities values ('${id.claimant}');
insert into public.claimant_cases (id, claimant_user_id, owner_user_id, state, version,
  route_profile, policy_pack_id, policy_pack_version, updated_at) values
  ('${id.case}', '${id.claimant}', '${id.owner}', 'approved', 6,
  'registered_recipient_v1', 'synthetic_policy_death_alpha', 1, now());
insert into public.claimant_owner_protection_cycles (id, case_id, owner_user_id,
  claimant_user_id, status, cooldown_expires_at, cycle_number) values
  ('${id.cycle}', '${id.case}', '${id.owner}', '${id.claimant}',
  'delivery_verified', now() - interval '1 day', 1);
insert into public.claimant_review_rounds values ('${id.round}', '${id.case}',
  'two_person_approved', 2, true, false);
insert into public.claimant_release_authority_identities
  (id, status, synthetic_only, live_release_authority, user_id) values
  ('${id.releaseAuthority}', 'active', true, false, '${id.releaseAuthorityUser}');
insert into public.claimant_release_authorizations values ('${id.authorization}',
  '${id.case}', '${id.cycle}', '${id.round}', '${id.releaseAuthority}', 6, 'authorized',
  true, false, false, 'synthetic_policy_death_alpha', 1, 2);
insert into public.claimant_device_keys values
  ('${id.key1}', '${id.claimant}', 'active', 1),
  ('${id.key2}', '${id.claimant}', 'active', 1);
insert into public.claimant_case_device_keys values
  ('${id.case}', '${id.key1}', '${id.claimant}', 'active'),
  ('${id.case}', '${id.key2}', '${id.claimant}', 'active');
insert into public.claimant_recipient_grants values
  ('${id.grant1}', '${id.case}', '${id.owner}', '${id.claimant}', '${id.key1}', 1,
    'sanduqkin:claim:recipient-grant:v1', 'registered_recipient_v2', 'X25519',
    'HKDF-SHA256', 'XChaCha20-Poly1305', '${grants[0].ephemeral}',
    '${grants[0].nonce}', '${grants[0].cipher}', 1, 'active'),
  ('${id.grant2}', '${id.case}', '${id.owner}', '${id.claimant}', '${id.key2}', 1,
    'sanduqkin:claim:recipient-grant:v1', 'registered_recipient_v2', 'X25519',
    'HKDF-SHA256', 'XChaCha20-Poly1305', '${grants[1].ephemeral}',
    '${grants[1].nonce}', '${grants[1].cipher}', 1, 'active');`;
  const liveFixture = buildClaimantEncryptedPackageDbTestSql({ fixtureOnly: true,
    ids: { ...id, authority: id.releaseAuthority, authorityUser: id.releaseAuthorityUser } });
  const grantProtocol = options.standalone
    ? "'sanduqkin:claim:recipient-grant:v1', 'registered_recipient_v2', 'X25519', 'HKDF-SHA256', 'XChaCha20-Poly1305'"
    : "'sanduqkin:claim:recipient-grant:v2', 'registered_recipient_v2', 'p256_ecdh', 'hkdf_sha256', 'xchacha20poly1305_ietf'";
  const interventionInsert = options.standalone
    ? `insert into public.claimant_review_interventions values ('${id.intervention}', '${id.case}');`
    : `insert into public.claimant_review_interventions(id, case_id, cycle_id, review_round_id,
        authority_identity_id, intervention_type, reason_class, source_review_status,
        source_round_version) values ('${id.intervention}', '${id.case}', '${id.cycle}',
        '${id.round}', '${id.releaseAuthority}', 'escalation', 'policy_review_required',
        'two_person_approved', 2);`;
  return `begin;
${options.standalone ? standaloneSchema() + standaloneFixture
    : liveFixture + `insert into auth.users(id) values ('${id.signingUser}');`}
insert into public.vault_assets values ('${id.asset}', '${id.owner}', 'document_location',
  '${ciphertext}', '${assetNonce}', '${snapshotAt}', '${snapshotAt}', null);
insert into public.claimant_release_packages (id, package_ref, case_id,
  release_authorization_id, cycle_id, review_round_id, owner_user_id, claimant_user_id,
  case_version, asset_count, grant_count, asset_snapshot_boundary,
  preparation_manifest_digest, prepared_at, expires_at) values
  ('${id.package}', 'synthetic_release_package_slice_4c', '${id.case}',
  '${id.authorization}', '${id.cycle}', '${id.round}', '${id.owner}', '${id.claimant}',
  6, 1, 2, '${snapshotAt}', '${"a".repeat(64)}', '${preparedAt}', '${expiresAt}');
insert into public.claimant_release_package_assets values ('${id.package}', '${id.case}',
  1, '${id.asset}', 'document_location', '${snapshotAt}', '${ciphertext}',
  '${assetNonce}', encode(extensions.digest(concat_ws('|', '${id.asset}', 'document_location',
  '${ciphertext}', '${assetNonce}'), 'sha256'), 'hex'), true);
insert into public.claimant_release_package_grants values
  ('${id.package}', '${id.case}', 1, '${id.grant1}', 1, '${id.key1}', 1,
    encode(extensions.digest(concat_ws('|', '${id.grant1}', '1', '${id.key1}', '1',
    ${grantProtocol}, '${grants[0].ephemeral}', '${grants[0].nonce}',
    '${grants[0].cipher}'), 'sha256'), 'hex'), true),
  ('${id.package}', '${id.case}', 2, '${id.grant2}', 1, '${id.key2}', 1,
    encode(extensions.digest(concat_ws('|', '${id.grant2}', '1', '${id.key2}', '1',
    ${grantProtocol}, '${grants[1].ephemeral}', '${grants[1].nonce}',
    '${grants[1].cipher}'), 'sha256'), 'hex'), true);
insert into public.claimant_release_signing_authorities (id, user_id, pseudonymous_ref)
values ('${id.signingAuthority}', '${id.signingUser}', 'synthetic_release_signer_primary');
insert into public.claimant_release_signing_keys (id, authority_id, signing_key_id,
  key_version, public_key, public_key_digest, valid_from, valid_until) values
  ('${id.signingKey}', '${id.signingAuthority}', 'claim-release-signing-synthetic-v1', 1,
  '${signingPublicKey}', encode(extensions.digest(
  decode(translate('${signingPublicKey}', '-_', '+/') || '=', 'base64'),
  'sha256'), 'hex'), now() - interval '1 day', now() + interval '30 days');
set local role service_role;
do $test$ declare v_result jsonb; begin
  begin
    update public.claimant_release_signing_authorities set user_id = '${id.owner}'
      where id = '${id.signingAuthority}';
    begin perform public.claimant_finalize_signed_release_package('${id.case}', '${id.package}',
      '${id.authorization}', '${id.signingAuthority}', '${id.signingKey}', 1,
      '${signingPublicKeyDigest}', 6,
      '${id.finalization}', ${manifests}, '${id.hostile}');
      raise exception 'owner signer was accepted';
    exception when insufficient_privilege then null; end;
    raise exception 'ROLLBACK_SIGNER' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_SIGNER' then raise; end if; end;
  begin
    update public.claimant_release_signing_keys set status = 'compromised'
      where id = '${id.signingKey}';
    begin perform public.claimant_finalize_signed_release_package('${id.case}', '${id.package}',
      '${id.authorization}', '${id.signingAuthority}', '${id.signingKey}', 1,
      '${signingPublicKeyDigest}', 6,
      '${id.finalization}', ${manifests}, '${id.hostile}');
      raise exception 'compromised key was accepted';
    exception when insufficient_privilege then null; end;
    raise exception 'ROLLBACK_KEY' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_KEY' then raise; end if; end;
  begin perform public.claimant_finalize_signed_release_package('${id.case}', '${id.package}',
    '${id.authorization}', '${id.signingAuthority}', '${id.signingKey}', 1,
    '${signingPublicKeyDigest}', 6,
    '${id.finalization}', jsonb_build_array(${manifests} -> 1, ${manifests} -> 0),
    '${id.hostile}');
    raise exception 'reordered manifests were accepted';
  exception when serialization_failure then null; end;
  begin
    update public.vault_assets set ciphertext = '${b64("tampered encrypted vault envelope")}'
      where id = '${id.asset}';
    begin perform public.claimant_finalize_signed_release_package('${id.case}', '${id.package}',
      '${id.authorization}', '${id.signingAuthority}', '${id.signingKey}', 1,
      '${signingPublicKeyDigest}', 6,
      '${id.finalization}', ${manifests}, '${id.hostile}');
      raise exception 'tampered asset was accepted';
    exception when serialization_failure then null; end;
    raise exception 'ROLLBACK_ASSET' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_ASSET' then raise; end if; end;
  begin
    ${interventionInsert}
    begin perform public.claimant_finalize_signed_release_package('${id.case}', '${id.package}',
      '${id.authorization}', '${id.signingAuthority}', '${id.signingKey}', 1,
      '${signingPublicKeyDigest}', 6,
      '${id.finalization}', ${manifests}, '${id.hostile}');
      raise exception 'intervention was accepted';
    exception when insufficient_privilege then null; end;
    raise exception 'ROLLBACK_INTERVENTION' using errcode = 'P0001';
  exception when sqlstate 'P0001' then if sqlerrm <> 'ROLLBACK_INTERVENTION' then raise; end if; end;
  v_result := public.claimant_finalize_signed_release_package('${id.case}', '${id.package}',
    '${id.authorization}', '${id.signingAuthority}', '${id.signingKey}', 1,
    '${signingPublicKeyDigest}', 6,
    '${id.finalization}', ${manifests}, '${id.first}');
  if v_result ->> 'case_state' <> 'release_ready'
    or (v_result ->> 'case_version')::integer <> 7
    or not (v_result ->> 'manifest_signed')::boolean
    or (v_result ->> 'retrieval_authorized')::boolean
    or (v_result ->> 'manifest_count')::integer <> 2 then
    raise exception 'signed finalization result was unsafe'; end if;
  if not (public.claimant_finalize_signed_release_package('${id.case}', '${id.package}',
    '${id.authorization}', '${id.signingAuthority}', '${id.signingKey}', 1,
    '${signingPublicKeyDigest}', 6,
    '${id.finalization}', ${manifests}, '${id.first}') ->> 'replayed')::boolean then
    raise exception 'signed finalization replay was unstable'; end if;
  begin perform public.claimant_finalize_signed_release_package('${id.case}', '${id.package}',
    '${id.authorization}', '${id.signingAuthority}', '${id.signingKey}', 2,
    '${signingPublicKeyDigest}', 6,
    '${id.finalization}', ${manifests}, '${id.first}');
    raise exception 'changed replay was accepted';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.claimant_release_package_finalizations) <> 1
    or (select count(*) from public.claimant_release_signed_manifests) <> 2
    or (select count(*) from public.claimant_release_package_finalization_events) <> 1
    or (select state from public.claimant_cases where id = '${id.case}') <> 'release_ready'
    or (select version from public.claimant_cases where id = '${id.case}') <> 7
    or (select retrieval_authorized from public.claimant_release_package_finalizations) then
    raise exception 'signed finalization atomic records failed'; end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_release_signed_manifests;
    raise exception 'authenticated role read signed manifest';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_finalize_signed_release_package('${id.case}', '${id.package}',
    '${id.authorization}', '${id.signingAuthority}', '${id.signingKey}', 1,
    '${signingPublicKeyDigest}', 6,
    '${id.finalization}', '[]', '${id.changed}');
    raise exception 'authenticated role called finalization';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role; rollback;
select 'CLAIMANT_SIGNED_MANIFEST_DB_TEST_PASSED';`;
}

function runClaimantSignedManifestDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildClaimantSignedManifestDbTestSql(options) });
  if (!output.includes("CLAIMANT_SIGNED_MANIFEST_DB_TEST_PASSED"))
    throw new Error("Signed-manifest DB marker was missing.");
}
function canonicalJson(value) { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value); }
function b64(value) { return Buffer.from(value).toString("base64url"); }
function sha256b64(value) { return createHash("sha256").update(value).digest("base64url"); }
function sha256hex(value) { return createHash("sha256").update(value).digest("hex"); }
function sqlJson(value) { return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`; }

if (require.main === module) { runClaimantSignedManifestDbTest();
  console.log("Claimant signed-manifest DB test passed."); }
module.exports = { buildClaimantSignedManifestDbTestSql, runClaimantSignedManifestDbTest,
  standaloneSchema };
