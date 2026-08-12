import { createECDH, createHash, createHmac } from "node:crypto";

const PROTOCOL = "sanduqkin:claim:native-enrollment:v1";
const FINGERPRINT_LABEL = "sanduqkin:claim:native-enrollment:public-key:v1";
const PROOF_KEY_LABEL = "sanduqkin:claim:native-enrollment:proof-key:v1";
const PROOF_MAC_LABEL = "sanduqkin:claim:native-enrollment:proof-mac:v1";

export function createNativeEnrollmentProofVector({ base64url, canonicalJson, syntheticMeta }) {
  const claimantKey = deterministicP256Key(4);
  const serverEphemeral = deterministicP256Key(5);
  const publicKeyFingerprint = sha256(concat(
    utf8(FINGERPRINT_LABEL), Uint8Array.of(0), claimantKey.publicKey,
  ));
  const challenge = {
    protocol: PROTOCOL,
    challenge_id: "61000000-0000-4000-8000-000000000016",
    claimant_id: "21000000-0000-4000-8000-000000000002",
    claimant_key_id: "31000000-0000-4000-8000-000000000013",
    claimant_key_version: 1,
    device_binding_digest: "11".repeat(32),
    eligibility_version: 3,
    expires_at: "2026-07-28T08:05:00.000Z",
    invitation_reference: "51000000-0000-4000-8000-000000000005",
    invitation_version: 2,
    issued_at: "2026-07-28T08:00:00.000Z",
    kdf_salt: base64url(bytesFromRange(17, 32)),
    nonce: base64url(bytesFromRange(49, 32)),
    origin: "https://api.sanduqkin.test",
    policy_pack_id: "death-only-v1",
    policy_pack_version: 4,
    public_key_fingerprint: base64url(publicKeyFingerprint),
    server_ephemeral_public_key: base64url(serverEphemeral.publicKey),
  };
  const canonicalChallenge = utf8(canonicalJson(challenge));
  const challengeDigest = sha256(canonicalChallenge);
  const proofKeyInfo = concat(utf8(PROOF_KEY_LABEL), Uint8Array.of(0), challengeDigest);
  const sharedSecret = ecdh(claimantKey.privateKey, serverEphemeral.publicKey);
  const proofKey = hkdfSha256(sharedSecret, bytesFromRange(17, 32), proofKeyInfo, 32);
  const proofMacInput = concat(utf8(PROOF_MAC_LABEL), Uint8Array.of(0), canonicalChallenge);
  const proofMac = hmacSha256(proofKey, proofMacInput);

  return {
    meta: {
      ...syntheticMeta,
      warning: "Private scalars exist only for deterministic reference testing and must never be imported into native custody.",
    },
    protocol: PROTOCOL,
    profile: "ios_secure_enclave_possession_v1",
    algorithms: {
      key_agreement: "p256_ecdh",
      public_key_encoding: "ansi_x9_63_uncompressed_base64url_no_padding",
      digest: "sha256",
      kdf: "hkdf_sha256",
      possession_proof: "hmac_sha256",
    },
    domain_separation: {
      public_key_fingerprint: FINGERPRINT_LABEL,
      proof_key: PROOF_KEY_LABEL,
      proof_mac: PROOF_MAC_LABEL,
      separator_hex: "00",
    },
    synthetic_key_material: {
      claimant_private_scalar: base64url(claimantKey.privateKey),
      claimant_public_key: base64url(claimantKey.publicKey),
      server_ephemeral_private_scalar: base64url(serverEphemeral.privateKey),
    },
    challenge_request: {
      capability: {
        claimed_hardware_security_level: "secure_enclave",
        key_algorithm: "p256_ecdh",
        platform: "ios",
        claimed_private_key_exportable: false,
        protocol: PROTOCOL,
        public_key_encoding: "ansi_x9_63_uncompressed",
        claimed_user_presence_binding: "transaction_bound",
      },
      invitation_reference: challenge.invitation_reference,
      policy_pack_id: challenge.policy_pack_id,
      policy_pack_version: challenge.policy_pack_version,
      protocol: PROTOCOL,
      public_key: base64url(claimantKey.publicKey),
    },
    challenge,
    challenge_bytes: base64url(canonicalChallenge),
    challenge_digest: base64url(challengeDigest),
    proof_key_info: base64url(proofKeyInfo),
    expected_shared_secret: base64url(sharedSecret),
    expected_proof_key: base64url(proofKey),
    proof_mac_input: base64url(proofMacInput),
    possession_proof: {
      protocol: PROTOCOL,
      challenge_id: challenge.challenge_id,
      claimant_id: challenge.claimant_id,
      claimant_key_id: challenge.claimant_key_id,
      claimant_key_version: challenge.claimant_key_version,
      device_binding_digest: challenge.device_binding_digest,
      invitation_reference: challenge.invitation_reference,
      public_key_fingerprint: challenge.public_key_fingerprint,
      proof_mac: base64url(proofMac),
    },
    negative_cases: [
      "wrong_claimant_private_key", "changed_claimant_binding", "changed_invitation_binding",
      "changed_invitation_version", "changed_key_binding", "changed_key_version",
      "changed_public_key_fingerprint", "changed_device_binding", "changed_eligibility_version",
      "changed_policy_pack", "changed_policy_pack_version", "changed_origin", "changed_nonce",
      "changed_kdf_salt", "changed_issued_at", "changed_expires_at", "changed_server_ephemeral_key",
      "replayed_consumed_challenge", "unsupported_protocol_version",
    ],
  };
}

function deterministicP256Key(lastByte) {
  const privateKey = new Uint8Array(32);
  privateKey[31] = lastByte;
  const instance = createECDH("prime256v1");
  instance.setPrivateKey(privateKey);
  return { privateKey, publicKey: new Uint8Array(instance.getPublicKey(undefined, "uncompressed")) };
}

function ecdh(privateKey, peerPublicKey) {
  const instance = createECDH("prime256v1");
  instance.setPrivateKey(privateKey);
  return new Uint8Array(instance.computeSecret(peerPublicKey));
}

function hkdfSha256(inputKeyMaterial, salt, info, outputLength) {
  if (!Number.isInteger(outputLength) || outputLength < 0 || outputLength > 255 * 32) {
    throw new Error("HKDF output length exceeds RFC 5869 bounds.");
  }
  const pseudorandomKey = hmacSha256(salt, inputKeyMaterial);
  let previous = new Uint8Array();
  let output = new Uint8Array();
  for (let counter = 1; output.length < outputLength; counter += 1) {
    previous = hmacSha256(pseudorandomKey, concat(previous, info, Uint8Array.of(counter)));
    output = concat(output, previous);
  }
  return output.slice(0, outputLength);
}

function sha256(value) { return new Uint8Array(createHash("sha256").update(value).digest()); }
function hmacSha256(key, value) { return new Uint8Array(createHmac("sha256", key).update(value).digest()); }
function utf8(value) { return new TextEncoder().encode(value); }
function bytesFromRange(start, length) { return Uint8Array.from({ length }, (_, index) => (start + index) & 0xff); }
function concat(...values) {
  const result = new Uint8Array(values.reduce((total, value) => total + value.length, 0));
  let offset = 0;
  for (const value of values) { result.set(value, offset); offset += value.length; }
  return result;
}
