import { createHash, createHmac } from "node:crypto";

const PROTOCOL = "sanduqkin:claim:offline-code:v2";
const AUTHORITY = "route_possession_only";
const LABELS = {
  locatorCommitment: "sanduqkin:claim:offline-code:v2:public-locator-commitment",
  locatorIndex: "sanduqkin:claim:offline-code:v2:server-locator-index",
  recordBinding: "sanduqkin:claim:offline-code:v2:record-binding",
  rootInput: "sanduqkin:claim:offline-code:v2:client-secret-root",
  proofSeed: "sanduqkin:claim:offline-code:v2:possession-proof-seed",
  possessionProof: "sanduqkin:claim:offline-code:v2:possession-proof",
  wrapKey: "sanduqkin:claim:offline-code:v2:release-wrap-key",
  wrapAssociatedData: "sanduqkin:claim:offline-code:v2:release-wrap-associated-data",
};

export function createOfflineCodeV2Vector({
  base64url,
  bytesFromRange,
  canonicalJson,
  ids,
  mek,
  sodium,
  syntheticMeta,
  timestamps,
}) {
  const locatorBytes = bytesFromRange(161, 16);
  const secretBytes = bytesFromRange(177, 24);
  const locator = formatHandoverValue("SK2-L-", locatorBytes);
  const secret = formatHandoverValue("SK2-S-", secretBytes);
  const normalizedLocator = normalize(locator, "SK2-L-");
  const normalizedSecret = normalize(secret, "SK2-S-");
  const kdfSalt = bytesFromRange(201, sodium.crypto_pwhash_SALTBYTES);
  const kdfProfile = {
    protocol: PROTOCOL,
    purpose: "client_secret_root",
    algorithm: "argon2id",
    profile_id: "argon2id-synthetic-test-v2",
    production_approved: false,
    opslimit: 2,
    memlimit_bytes: 67_108_864,
    output_bytes: 32,
    salt: base64url(kdfSalt),
  };
  const publicLocator = {
    protocol: PROTOCOL,
    purpose: "public_locator",
    encoding: "crockford_base32_checksum",
    locator,
  };
  const clientSecret = {
    protocol: PROTOCOL,
    purpose: "client_held_secret",
    encoding: "crockford_base32_checksum",
    secret,
  };
  const locatorCommitment = sha256(canonicalBytes(canonicalJson, {
    protocol: PROTOCOL,
    purpose: "public_locator_commitment",
    label: LABELS.locatorCommitment,
    locator_record_id: ids.locatorRecord,
    locator_version: 2,
    normalized_locator: normalizedLocator,
  }));
  const rootInput = {
    protocol: PROTOCOL,
    purpose: "client_secret_root",
    label: LABELS.rootInput,
    locator_record_id: ids.locatorRecord,
    locator_version: 2,
    normalized_locator: normalizedLocator,
    normalized_secret: normalizedSecret,
  };
  const rootInputCanonical = canonicalBytes(canonicalJson, rootInput);
  const root = sodium.crypto_pwhash(
    32,
    rootInputCanonical,
    kdfSalt,
    kdfProfile.opslimit,
    kdfProfile.memlimit_bytes,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
  const provisionalBinding = {
    protocol: PROTOCOL,
    purpose: "record_binding",
    locator_record_id: ids.locatorRecord,
    locator_version: 2,
    locator_commitment: base64url(locatorCommitment),
    grant_id: ids.grant,
    owner_id: ids.owner,
    kdf_profile_id: kdfProfile.profile_id,
    proof_key_version: 1,
  };
  const provisionalDigest = sha256(concat(
    utf8(LABELS.recordBinding),
    Uint8Array.of(0),
    canonicalBytes(canonicalJson, provisionalBinding),
  ));
  const proofContext = derivationContext(canonicalJson, "possession_proof_seed", LABELS.proofSeed, provisionalDigest);
  const proofSeed = hkdfSha256(root, sha256(proofContext), proofContext, 32);
  const proofKeys = sodium.crypto_sign_seed_keypair(proofSeed);
  const recordBinding = {
    ...provisionalBinding,
    proof_public_key: base64url(proofKeys.publicKey),
  };
  const recordBindingCanonical = canonicalBytes(canonicalJson, recordBinding);
  const recordBindingDigest = sha256(concat(
    utf8(LABELS.recordBinding),
    Uint8Array.of(0),
    recordBindingCanonical,
  ));
  const wrapContext = derivationContext(canonicalJson, "release_wrap_key", LABELS.wrapKey, recordBindingDigest);
  const wrapKey = hkdfSha256(root, sha256(wrapContext), wrapContext, 32);
  const locatorIndexKey = bytesFromRange(217, 32);
  const locatorIndexInput = canonicalBytes(canonicalJson, {
    protocol: PROTOCOL,
    purpose: "server_locator_index",
    label: LABELS.locatorIndex,
    normalized_locator: normalizedLocator,
  });
  const locatorDigest = hmacSha256(locatorIndexKey, locatorIndexInput);
  const challenge = {
    protocol: PROTOCOL,
    purpose: "possession_challenge",
    authority: AUTHORITY,
    challenge_id: ids.challenge,
    locator_record_id: ids.locatorRecord,
    locator_version: 2,
    locator_commitment: base64url(locatorCommitment),
    proof_key_version: 1,
    proof_public_key: recordBinding.proof_public_key,
    record_binding_digest: base64url(recordBindingDigest),
    nonce: base64url(bytesFromRange(249, 32)),
    origin: "https://app.sanduqkin.test",
    issued_at: timestamps.created,
    expires_at: timestamps.challengeExpiry,
  };
  const challengeCanonical = canonicalBytes(canonicalJson, challenge);
  const proofMessage = {
    protocol: PROTOCOL,
    purpose: "possession_proof",
    label: LABELS.possessionProof,
    challenge,
  };
  const proofMessageCanonical = canonicalBytes(canonicalJson, proofMessage);
  const challengeSignature = sodium.crypto_sign_detached(proofMessageCanonical, proofKeys.privateKey);
  const possessionProof = {
    protocol: PROTOCOL,
    purpose: "possession_proof",
    authority: AUTHORITY,
    challenge_id: challenge.challenge_id,
    locator_record_id: recordBinding.locator_record_id,
    locator_version: recordBinding.locator_version,
    proof_key_version: recordBinding.proof_key_version,
    proof_public_key: recordBinding.proof_public_key,
    record_binding_digest: base64url(recordBindingDigest),
    signature: base64url(challengeSignature),
  };
  const wrapAssociatedData = {
    protocol: PROTOCOL,
    purpose: "release_wrap_associated_data",
    label: LABELS.wrapAssociatedData,
    record_binding: recordBinding,
    record_binding_digest: base64url(recordBindingDigest),
    created_at: timestamps.created,
  };
  const wrapAssociatedDataCanonical = canonicalBytes(canonicalJson, wrapAssociatedData);
  const wrapNonce = bytesFromRange(25, 24);
  const wrappedMek = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    mek,
    wrapAssociatedDataCanonical,
    null,
    wrapNonce,
    wrapKey,
  );
  const wrappedMekEnvelope = {
    protocol: PROTOCOL,
    purpose: "release_material_wrap",
    profile: "offline_code_v2",
    algorithm: "xchacha20poly1305_ietf",
    locator_record_id: recordBinding.locator_record_id,
    locator_version: recordBinding.locator_version,
    locator_commitment: recordBinding.locator_commitment,
    grant_id: recordBinding.grant_id,
    owner_id: recordBinding.owner_id,
    created_at: timestamps.created,
    kdf_profile_id: recordBinding.kdf_profile_id,
    proof_key_version: recordBinding.proof_key_version,
    record_binding_digest: base64url(recordBindingDigest),
    nonce: base64url(wrapNonce),
    ciphertext: base64url(wrappedMek),
  };

  return {
    vector: {
      meta: {
        ...syntheticMeta,
        warning: "All values are fixed synthetic evidence. The protocol is immutable-false, runtime-disconnected, and not production approved.",
      },
      protocol: PROTOCOL,
      approved: false,
      authority: AUTHORITY,
      algorithms: {
        locator_encoding: "crockford_base32_checksum",
        locator_index: "hmac_sha256",
        locator_commitment: "sha256",
        client_secret_kdf: "argon2id",
        subkey_kdf: "hkdf_sha256",
        possession_proof: "ed25519",
        release_wrap: "xchacha20poly1305_ietf",
      },
      labels: LABELS,
      public_locator: publicLocator,
      synthetic_client_secret: clientSecret,
      normalized_material: {
        locator_bytes: base64url(locatorBytes),
        normalized_locator: normalizedLocator,
        secret_bytes: base64url(secretBytes),
        normalized_secret: normalizedSecret,
      },
      kdf_profile: kdfProfile,
      synthetic_locator_index_key: base64url(locatorIndexKey),
      locator_index_input: base64url(locatorIndexInput),
      locator_digest: base64url(locatorDigest),
      record_binding: recordBinding,
      record_binding_canonical: base64url(recordBindingCanonical),
      record_binding_digest: base64url(recordBindingDigest),
      derivation: {
        root_input_canonical: base64url(rootInputCanonical),
        root: base64url(root),
        proof_binding: provisionalBinding,
        proof_binding_digest: base64url(provisionalDigest),
        proof_context: base64url(proofContext),
        proof_seed: base64url(proofSeed),
        proof_public_key: base64url(proofKeys.publicKey),
        synthetic_proof_private_key: base64url(proofKeys.privateKey),
        wrap_context: base64url(wrapContext),
        wrap_key: base64url(wrapKey),
      },
      challenge,
      challenge_canonical: base64url(challengeCanonical),
      proof_message: proofMessage,
      proof_message_canonical: base64url(proofMessageCanonical),
      possession_proof: possessionProof,
      wrap: {
        associated_data: wrapAssociatedData,
        associated_data_canonical: base64url(wrapAssociatedDataCanonical),
        mek: base64url(mek),
        envelope: wrappedMekEnvelope,
        expected_unwrapped_mek: base64url(mek),
      },
      protocol_bundle: {
        public_locator: publicLocator,
        kdf_profile: kdfProfile,
        record_binding: recordBinding,
        challenge,
        possession_proof: possessionProof,
        wrapped_mek: wrappedMekEnvelope,
      },
      negative_cases: [
        "v1_protocol", "locator_only_authority", "weak_client_secret", "malformed_locator",
        "malformed_secret", "changed_locator_record", "changed_locator_version",
        "changed_locator_commitment", "changed_record_binding", "changed_challenge_origin",
        "changed_challenge_expiry", "changed_grant_binding", "changed_owner_binding",
        "changed_kdf_profile", "changed_proof_key_version", "changed_signature",
        "wrong_secret", "changed_ciphertext", "cross_record_substitution",
      ],
    },
    releaseMaterial: {
      kdfProfile,
      wrappedMek,
    },
  };
}

function derivationContext(canonicalJson, purpose, label, bindingDigest) {
  return canonicalBytes(canonicalJson, {
    protocol: PROTOCOL,
    purpose,
    label,
    binding_digest: toBase64url(bindingDigest),
  });
}

function normalize(value, prefix) {
  return value.slice(prefix.length).replaceAll("-", "").slice(0, -1);
}

const crockfordAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const crockfordCheckAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ*~$=U";

function formatHandoverValue(prefix, bytes) {
  const payload = crockfordEncode(bytes);
  const groups = payload.match(/.{1,4}/g) ?? [];
  return `${prefix}${groups.join("-")}-${crockfordChecksum(payload)}`;
}

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
  if (bitCount > 0) encoded += crockfordAlphabet[(bits << (5 - bitCount)) & 31];
  return encoded;
}

function crockfordChecksum(payload) {
  let remainder = 0;
  for (const character of payload) remainder = (remainder * 32 + crockfordAlphabet.indexOf(character)) % crockfordCheckAlphabet.length;
  return crockfordCheckAlphabet[remainder];
}

function canonicalBytes(canonicalJson, value) { return utf8(canonicalJson(value)); }
function utf8(value) { return new TextEncoder().encode(value); }
function sha256(value) { return new Uint8Array(createHash("sha256").update(value).digest()); }
function hmacSha256(key, value) { return new Uint8Array(createHmac("sha256", key).update(value).digest()); }
function hkdfSha256(ikm, salt, info, length) {
  const prk = hmacSha256(salt, ikm);
  let previous = new Uint8Array();
  let output = new Uint8Array();
  for (let counter = 1; output.length < length; counter += 1) {
    previous = hmacSha256(prk, concat(previous, info, Uint8Array.of(counter)));
    output = concat(output, previous);
  }
  return output.slice(0, length);
}
function concat(...values) {
  const output = new Uint8Array(values.reduce((sum, value) => sum + value.length, 0));
  let offset = 0;
  for (const value of values) { output.set(value, offset); offset += value.length; }
  return output;
}
function toBase64url(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let output = "";
  for (let index = 0; index < value.length; index += 3) {
    const first = value[index] ?? 0;
    const second = value[index + 1] ?? 0;
    const third = value[index + 2] ?? 0;
    const block = (first << 16) | (second << 8) | third;
    output += alphabet[(block >>> 18) & 63] + alphabet[(block >>> 12) & 63];
    if (index + 1 < value.length) output += alphabet[(block >>> 6) & 63];
    if (index + 2 < value.length) output += alphabet[block & 63];
  }
  return output;
}
