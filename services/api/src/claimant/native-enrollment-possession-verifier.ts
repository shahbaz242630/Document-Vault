import { createECDH, createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  canonicalJsonBytes,
  NATIVE_ENROLLMENT_PROOF_KEY_LABEL_V1,
  NATIVE_ENROLLMENT_PROOF_MAC_LABEL_V1,
  assertNativeEnrollmentChallengeV1,
  assertNativeEnrollmentPossessionProofV1,
  type NativeEnrollmentChallengeV1,
  type NativeEnrollmentPossessionProofV1,
} from "@vault/shared-types";

import {
  assertNativeEnrollmentPublicKeyFingerprintV1,
  assertValidP256PointV1,
} from "./native-enrollment-verifier-contract.js";

export function verifyNativeEnrollmentPossessionV1(input: Readonly<{
  challenge: NativeEnrollmentChallengeV1;
  claimantPublicKeyBase64Url: string;
  now?: Date;
  proof: NativeEnrollmentPossessionProofV1;
  serverEphemeralPrivateKey: Uint8Array;
}>): Readonly<{ challengeDigest: string; publicKeyJwk: Readonly<{ crv: "P-256"; kty: "EC"; x: string; y: string }> }> {
  const challenge = assertNativeEnrollmentChallengeV1(input.challenge);
  const proof = assertNativeEnrollmentPossessionProofV1(input.proof);
  assertFresh(challenge, input.now ?? new Date());
  assertProofBindings(challenge, proof);
  assertNativeEnrollmentPublicKeyFingerprintV1(
    input.claimantPublicKeyBase64Url,
    challenge.public_key_fingerprint,
  );
  const claimantPublicKey = decodeExact(input.claimantPublicKeyBase64Url, 65);
  assertValidP256PointV1(claimantPublicKey);
  if (input.serverEphemeralPrivateKey.byteLength !== 32) fail();
  let sharedSecret: Buffer;
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(input.serverEphemeralPrivateKey);
    if (!timingSafeEqual(ecdh.getPublicKey(), decodeExact(challenge.server_ephemeral_public_key, 65))) fail();
    sharedSecret = ecdh.computeSecret(claimantPublicKey);
  } catch { fail(); }
  const canonical = canonicalJsonBytes(challenge as never);
  const challengeDigest = sha256(canonical);
  const proofKey = hkdfSha256(
    sharedSecret,
    decodeExact(challenge.kdf_salt, 32),
    concat(utf8(NATIVE_ENROLLMENT_PROOF_KEY_LABEL_V1), Uint8Array.of(0), challengeDigest),
    32,
  );
  const expectedMac = createHmac("sha256", proofKey)
    .update(concat(utf8(NATIVE_ENROLLMENT_PROOF_MAC_LABEL_V1), Uint8Array.of(0), canonical))
    .digest();
  const actualMac = decodeExact(proof.proof_mac, 32);
  if (!timingSafeEqual(expectedMac, actualMac)) fail();
  return {
    challengeDigest: Buffer.from(challengeDigest).toString("base64url"),
    publicKeyJwk: {
      crv: "P-256", kty: "EC",
      x: Buffer.from(claimantPublicKey.slice(1, 33)).toString("base64url"),
      y: Buffer.from(claimantPublicKey.slice(33)).toString("base64url"),
    },
  };
}

function assertProofBindings(challenge: NativeEnrollmentChallengeV1, proof: NativeEnrollmentPossessionProofV1) {
  for (const [left, right] of [
    [challenge.challenge_id, proof.challenge_id], [challenge.claimant_id, proof.claimant_id],
    [challenge.claimant_key_id, proof.claimant_key_id], [challenge.claimant_key_version, proof.claimant_key_version],
    [challenge.device_binding_digest, proof.device_binding_digest],
    [challenge.invitation_reference, proof.invitation_reference],
    [challenge.public_key_fingerprint, proof.public_key_fingerprint],
    [challenge.protocol, proof.protocol],
  ] as const) if (left !== right) fail();
}

function assertFresh(challenge: NativeEnrollmentChallengeV1, now: Date) {
  const issued = Date.parse(challenge.issued_at); const expires = Date.parse(challenge.expires_at);
  if (now.getTime() < issued || now.getTime() >= expires) fail();
}

function hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  if (length < 1 || length > 255 * 32) fail();
  const prk = createHmac("sha256", salt).update(ikm).digest();
  let previous = Buffer.alloc(0); let output = Buffer.alloc(0);
  for (let counter = 1; output.byteLength < length; counter += 1) {
    previous = createHmac("sha256", prk).update(concat(previous, info, Uint8Array.of(counter))).digest();
    output = Buffer.concat([output, previous]);
  }
  return output.subarray(0, length);
}

function decodeExact(value: string, length: number): Buffer {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) fail();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength !== length || decoded.toString("base64url") !== value) fail();
  return decoded;
}
function sha256(value: Uint8Array): Buffer { return createHash("sha256").update(value).digest(); }
function utf8(value: string): Uint8Array { return new TextEncoder().encode(value); }
function concat(...values: readonly Uint8Array[]): Buffer { return Buffer.concat(values); }
function fail(): never { throw new Error("Native enrollment possession verification failed."); }
