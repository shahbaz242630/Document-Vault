import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sodium from "libsodium-wrappers-sumo";

import { createRecipientV2Vector } from "./claim-vector-generator/recipient-v2-vector.mjs";
import { createNativeEnrollmentProofVector } from "./claim-vector-generator/native-enrollment-proof-vector.mjs";
import { createAppAttestBindingVector } from "./claim-vector-generator/app-attest-binding-vector.mjs";
import { createClaimStateVector } from "./claim-vector-generator/state-vector.mjs";
import { createOfflineCodeV2Vector } from "./claim-vector-generator/offline-code-v2-vector.mjs";

await sodium.ready;

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(
  repositoryRoot,
  "packages",
  "shared-types",
  "test-vectors",
  "claim",
);

const protocols = {
  grant: "sanduqkin:claim:recipient-grant:v1",
  state: "sanduqkin:claim:state:v1",
  release: "sanduqkin:claim:release-package:v1",
};

const ids = {
  owner: "10000000-0000-4000-8000-000000000001",
  recipient: "20000000-0000-4000-8000-000000000002",
  recipientKey: "30000000-0000-4000-8000-000000000003",
  recipientKeyV2: "30000000-0000-4000-8000-000000000013",
  grant: "40000000-0000-4000-8000-000000000004",
  grantV2: "40000000-0000-4000-8000-000000000014",
  locatorRecord: "50000000-0000-4000-8000-000000000005",
  challenge: "60000000-0000-4000-8000-000000000006",
  challengeV2: "60000000-0000-4000-8000-000000000016",
  claimRegistered: "70000000-0000-4000-8000-000000000007",
  claimOffline: "70000000-0000-4000-8000-000000000008",
  packageRegistered: "80000000-0000-4000-8000-000000000009",
  packageOffline: "80000000-0000-4000-8000-00000000000a",
};

const timestamps = {
  created: "2026-07-28T08:00:00.000Z",
  challengeExpiry: "2026-07-28T08:05:00.000Z",
  packageExpiry: "2026-07-31T08:00:00.000Z",
  snapshot: "2026-07-28T07:59:59.000Z",
};

const syntheticMeta = {
  generated_by: "scripts/generate-claim-test-vectors.mjs",
  production_data: false,
  synthetic_only: true,
};

const base64url = (bytes) =>
  sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
const utf8 = (value) => sodium.from_string(value);
const concat = (...values) => {
  const length = values.reduce((total, value) => total + value.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
};
const hash = (bytes, key) =>
  sodium.crypto_generichash(32, bytes, key);
const digest = (bytes) => base64url(hash(bytes));
const bytesFromRange = (start, length) =>
  Uint8Array.from({ length }, (_, index) => (start + index) & 0xff);

function canonicalJson(value) {
  return JSON.stringify(sortCanonical(value));
}

function sortCanonical(value) {
  if (Array.isArray(value)) {
    return value.map(sortCanonical);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortCanonical(value[key])]),
    );
  }
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error("Canonical claim JSON permits safe integers only.");
  }
  return value;
}

function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function deterministicSeal(message, recipientPublicKey, ephemeralSeed) {
  const ephemeral = sodium.crypto_box_seed_keypair(ephemeralSeed);
  const nonce = sodium.crypto_generichash(
    sodium.crypto_box_NONCEBYTES,
    concat(ephemeral.publicKey, recipientPublicKey),
  );
  const boxed = sodium.crypto_box_easy(
    message,
    nonce,
    recipientPublicKey,
    ephemeral.privateKey,
  );
  return concat(ephemeral.publicKey, boxed);
}

const recipientSeed = bytesFromRange(1, sodium.crypto_box_SEEDBYTES);
const recipientKeys = sodium.crypto_box_seed_keypair(recipientSeed);
const recipientKeyFingerprint = hash(
  concat(
    utf8(protocols.grant),
    Uint8Array.of(0),
    uint32(1),
    recipientKeys.publicKey,
  ),
);
const mek = bytesFromRange(65, 32);
const grantNonce = bytesFromRange(97, 16);
const grantPlaintext = {
  protocol: protocols.grant,
  grant_id: ids.grant,
  owner_id: ids.owner,
  recipient_id: ids.recipient,
  recipient_key_id: ids.recipientKey,
  recipient_key_fingerprint: base64url(recipientKeyFingerprint),
  issued_at: timestamps.created,
  grant_nonce: base64url(grantNonce),
  mek: base64url(mek),
};
const grantCanonical = canonicalJson(grantPlaintext);
const sealedGrant = deterministicSeal(
  utf8(grantCanonical),
  recipientKeys.publicKey,
  bytesFromRange(129, sodium.crypto_box_SEEDBYTES),
);
const openedGrant = sodium.crypto_box_seal_open(
  sealedGrant,
  recipientKeys.publicKey,
  recipientKeys.privateKey,
);
if (sodium.to_string(openedGrant) !== grantCanonical) {
  throw new Error("Deterministic registered-recipient fixture did not open.");
}

const recipientVector = {
  meta: syntheticMeta,
  protocol: protocols.grant,
  key_material: {
    recipient_seed: base64url(recipientSeed),
    recipient_public_key: base64url(recipientKeys.publicKey),
    recipient_private_key: base64url(recipientKeys.privateKey),
    recipient_key_fingerprint: base64url(recipientKeyFingerprint),
    key_version: 1,
  },
  plaintext: grantPlaintext,
  canonical_plaintext: base64url(utf8(grantCanonical)),
  canonical_plaintext_digest: digest(utf8(grantCanonical)),
  captured_sealed_box_ciphertext: base64url(sealedGrant),
  envelope: {
    protocol: protocols.grant,
    algorithm: "crypto_box_seal",
    grant_id: ids.grant,
    recipient_id: ids.recipient,
    recipient_key_id: ids.recipientKey,
    recipient_key_version: 1,
    ciphertext: base64url(sealedGrant),
    created_at: timestamps.created,
    grant_version: 1,
    revoked_at: null,
  },
  expected_opened_plaintext: grantPlaintext,
  negative_cases: [
    "wrong_private_key",
    "changed_recipient_binding",
    "changed_key_binding",
    "changed_grant_binding",
    "truncated_ciphertext",
    "unsupported_version",
  ],
};

const recipientV2Vector = createRecipientV2Vector({
  base64url,
  canonicalJson,
  ids,
  mek,
  sodium,
  syntheticMeta,
  timestamps,
});

const nativeEnrollmentProofVector = createNativeEnrollmentProofVector({
  base64url,
  canonicalJson,
  syntheticMeta,
});

const appAttestBindingVector = createAppAttestBindingVector({
  base64url,
  canonicalJson,
  nativeEnrollmentProofVector,
  syntheticMeta,
});

const { vector: offlineVector, releaseMaterial: offlineReleaseMaterial } =
  createOfflineCodeV2Vector({
    base64url,
    bytesFromRange,
    canonicalJson,
    ids,
    mek,
    sodium,
    syntheticMeta,
    timestamps,
  });

const stateVector = createClaimStateVector({
  meta: syntheticMeta,
  protocol: protocols.state,
  serverTime: timestamps.created,
});

const signingSeed = bytesFromRange(57, sodium.crypto_sign_SEEDBYTES);
const signingKeys = sodium.crypto_sign_seed_keypair(signingSeed);
const signingKeyId = "claim-release-signing-synthetic-v1";
const assetCiphertexts = [
  utf8("synthetic-encrypted-asset-envelope-01"),
  utf8("synthetic-encrypted-asset-envelope-02"),
];
const assetDigests = assetCiphertexts.map(digest);

function createReleaseCase({
  claimId,
  packageId,
  releaseMaterial,
}) {
  const manifest = {
    protocol: protocols.release,
    claim_id: claimId,
    release_package_id: packageId,
    owner_id: ids.owner,
    claimant_id: ids.recipient,
    claim_version: 11,
    cancellation_version: 3,
    created_at: timestamps.created,
    expires_at: timestamps.packageExpiry,
    asset_snapshot_boundary: timestamps.snapshot,
    asset_ciphertext_digests: assetDigests,
    policy_decision_version: 5,
    signing_key_id: signingKeyId,
    release_material: releaseMaterial,
  };
  const canonical = canonicalJson(manifest);
  return {
    manifest,
    canonical_manifest: base64url(utf8(canonical)),
    detached_signature: base64url(
      sodium.crypto_sign_detached(utf8(canonical), signingKeys.privateKey),
    ),
    expected_valid: true,
  };
}

const releaseVector = {
  meta: syntheticMeta,
  protocol: protocols.release,
  signing_key: {
    signing_key_id: signingKeyId,
    seed: base64url(signingSeed),
    public_key: base64url(signingKeys.publicKey),
    private_key: base64url(signingKeys.privateKey),
  },
  registered_recipient: createReleaseCase({
    claimId: ids.claimRegistered,
    packageId: ids.packageRegistered,
    releaseMaterial: {
      profile: "registered_recipient_v1",
      grant_id: ids.grant,
      grant_version: 1,
      recipient_id: ids.recipient,
      recipient_key_id: ids.recipientKey,
      recipient_key_version: 1,
      sealed_grant_digest: digest(sealedGrant),
    },
  }),
  offline_code: createReleaseCase({
    claimId: ids.claimOffline,
    packageId: ids.packageOffline,
    releaseMaterial: {
      profile: "offline_code_v2",
      locator_record_id: ids.locatorRecord,
      locator_version: 2,
      kdf_profile_id: offlineReleaseMaterial.kdfProfile.profile_id,
      proof_key_version: 1,
      wrapped_mek_digest: digest(offlineReleaseMaterial.wrappedMek),
    },
  }),
  negative_cases: [
    "missing_route_discriminator",
    "cross_route_material_substitution",
    "stale_recipient_key",
    "stale_kdf_profile",
    "changed_cancellation_version",
    "reordered_asset_digests",
    "unknown_signing_key",
    "expired_package",
    "inner_outer_binding_mismatch",
  ],
};

const checkOnly = process.argv.includes("--check");

if (!checkOnly) {
  await mkdir(outputDirectory, { recursive: true });
}
await Promise.all([
  writeVector("recipient-grant-v1.json", recipientVector),
  writeVector("recipient-grant-v2.json", recipientV2Vector),
  writeVector("native-enrollment-proof-v1.json", nativeEnrollmentProofVector),
  writeVector("app-attest-binding-v1.json", appAttestBindingVector),
  writeVector("offline-code-v2.json", offlineVector),
  writeVector("claim-state-v1.json", stateVector),
  writeVector("release-package-v1.json", releaseVector),
]);

async function writeVector(filename, value) {
  const path = join(outputDirectory, filename);
  const expected = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    const actual = await readFile(path, "utf8");
    const normalizedActual = actual.replace(/\r\n?/g, "\n");
    if (normalizedActual !== expected) {
      throw new Error(`${filename} is not reproducible; regenerate claim vectors.`);
    }
    return;
  }
  await writeFile(path, expected, "utf8");
}
