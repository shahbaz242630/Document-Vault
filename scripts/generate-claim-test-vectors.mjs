import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sodium from "libsodium-wrappers-sumo";

import { createRecipientV2Vector } from "./claim-vector-generator/recipient-v2-vector.mjs";
import { createClaimStateVector } from "./claim-vector-generator/state-vector.mjs";

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
  offline: "sanduqkin:claim:offline-code:v2",
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

const crockfordAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const crockfordCheckAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ*~$=U";

function crockfordEncode(bytes) {
  let bits = 0;
  let bitCount = 0;
  let encoded = "";
  for (const byte of bytes) {
    bits = (bits << 8) | byte;
    bitCount += 8;
    while (bitCount >= 5) {
      bitCount -= 5;
      encoded += crockfordAlphabet[(bits >>> bitCount) & 31];
      bits &= (1 << bitCount) - 1;
    }
  }
  if (bitCount > 0) {
    encoded += crockfordAlphabet[(bits << (5 - bitCount)) & 31];
  }
  return encoded;
}

function crockfordChecksum(payload) {
  let remainder = 0;
  for (const character of payload) {
    remainder =
      (remainder * 32 + crockfordAlphabet.indexOf(character)) %
      crockfordCheckAlphabet.length;
  }
  return crockfordCheckAlphabet[remainder];
}

function formatHandoverValue(prefix, bytes) {
  const payload = crockfordEncode(bytes);
  const groups = payload.match(/.{1,4}/g) ?? [];
  return `${prefix}${groups.join("-")}-${crockfordChecksum(payload)}`;
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

const locatorBytes = bytesFromRange(161, 16);
const secretBytes = bytesFromRange(177, 24);
const locator = formatHandoverValue("SK2-L-", locatorBytes);
const secret = formatHandoverValue("SK2-S-", secretBytes);
const normalizedSecret = secret.replace(/^SK2-S-/, "").replace(/-/g, "").slice(0, -1);
const kdfSalt = bytesFromRange(201, sodium.crypto_pwhash_SALTBYTES);
const testKdfProfile = {
  algorithm: "argon2id",
  profile_id: "argon2id-synthetic-test-v1",
  production_approved: false,
  opslimit: 2,
  memlimit_bytes: 67_108_864,
  output_bytes: 32,
  salt: base64url(kdfSalt),
};
const root = sodium.crypto_pwhash(
  32,
  normalizedSecret,
  kdfSalt,
  testKdfProfile.opslimit,
  testKdfProfile.memlimit_bytes,
  sodium.crypto_pwhash_ALG_ARGON2ID13,
);
const proofSeed = sodium.crypto_kdf_derive_from_key(32, 1, "SKCLMV2!", root);
const wrapKey = sodium.crypto_kdf_derive_from_key(32, 2, "SKCLMV2!", root);
const proofKeys = sodium.crypto_sign_seed_keypair(proofSeed);
const locatorIndexKey = bytesFromRange(217, 32);
const normalizedLocator = locator.replace(/^SK2-L-/, "").replace(/-/g, "").slice(0, -1);
const locatorDigest = hash(utf8(normalizedLocator), locatorIndexKey);
const locatorHash = hash(utf8(normalizedLocator));
const challenge = {
  protocol: protocols.offline,
  challenge_id: ids.challenge,
  nonce: base64url(bytesFromRange(249, 32)),
  origin: "https://app.sanduqkin.test",
  expires_at: timestamps.challengeExpiry,
  locator_hash: base64url(locatorHash),
};
const challengeCanonical = canonicalJson(challenge);
const challengeSignature = sodium.crypto_sign_detached(
  utf8(challengeCanonical),
  proofKeys.privateKey,
);
const wrapAssociatedData = {
  protocol: protocols.offline,
  locator_digest: base64url(locatorDigest),
  grant_id: ids.grant,
  owner_id: ids.owner,
  created_at: timestamps.created,
};
const wrapAssociatedDataCanonical = canonicalJson(wrapAssociatedData);
const wrapNonce = bytesFromRange(25, 24);
const wrappedMek = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
  mek,
  utf8(wrapAssociatedDataCanonical),
  null,
  wrapNonce,
  wrapKey,
);

const offlineVector = {
  meta: {
    ...syntheticMeta,
    warning:
      "The Argon2id profile is synthetic-only and is not approved for production. Production values remain blocked on device benchmarks and security review.",
  },
  protocol: protocols.offline,
  human_material: {
    locator_bytes: base64url(locatorBytes),
    locator,
    normalized_locator: normalizedLocator,
    secret_bytes: base64url(secretBytes),
    secret,
    normalized_secret: normalizedSecret,
  },
  kdf_profile: testKdfProfile,
  synthetic_locator_index_key: base64url(locatorIndexKey),
  derived: {
    root: base64url(root),
    proof_seed: base64url(proofSeed),
    proof_public_key: base64url(proofKeys.publicKey),
    proof_private_key: base64url(proofKeys.privateKey),
    wrap_key: base64url(wrapKey),
    locator_digest: base64url(locatorDigest),
  },
  challenge,
  challenge_canonical: base64url(utf8(challengeCanonical)),
  challenge_signature: base64url(challengeSignature),
  wrap: {
    associated_data: wrapAssociatedData,
    associated_data_canonical: base64url(utf8(wrapAssociatedDataCanonical)),
    mek: base64url(mek),
    nonce: base64url(wrapNonce),
    ciphertext: base64url(wrappedMek),
    expected_unwrapped_mek: base64url(mek),
  },
  negative_cases: [
    "changed_locator",
    "changed_challenge_origin",
    "expired_challenge",
    "changed_grant_binding",
    "changed_owner_binding",
    "changed_signature",
    "wrong_secret",
    "changed_ciphertext",
    "unsupported_protocol_version",
    "unapproved_production_kdf_profile",
  ],
};

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
      kdf_profile_id: testKdfProfile.profile_id,
      proof_key_version: 1,
      wrapped_mek_digest: digest(wrappedMek),
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
  writeVector("offline-code-v2.json", offlineVector),
  writeVector("claim-state-v1.json", stateVector),
  writeVector("release-package-v1.json", releaseVector),
]);

async function writeVector(filename, value) {
  const path = join(outputDirectory, filename);
  const expected = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    const actual = await readFile(path, "utf8");
    if (actual !== expected) {
      throw new Error(`${filename} is not reproducible; regenerate claim vectors.`);
    }
    return;
  }
  await writeFile(path, expected, "utf8");
}
