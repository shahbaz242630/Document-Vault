import { createECDH, createHash } from "node:crypto";

import { NATIVE_ENROLLMENT_PUBLIC_KEY_FINGERPRINT_LABEL_V1 } from "@vault/shared-types";

export function deriveNativeEnrollmentPublicKeyFingerprintV1(publicKeyBase64Url: string): string {
  const publicKey = decodeCanonicalPublicKey(publicKeyBase64Url);
  assertValidP256PointV1(publicKey);
  return createHash("sha256")
    .update(NATIVE_ENROLLMENT_PUBLIC_KEY_FINGERPRINT_LABEL_V1, "utf8")
    .update(Uint8Array.of(0))
    .update(publicKey)
    .digest("base64url");
}

export function assertNativeEnrollmentPublicKeyFingerprintV1(
  publicKeyBase64Url: string,
  claimedFingerprint: string,
): void {
  if (deriveNativeEnrollmentPublicKeyFingerprintV1(publicKeyBase64Url) !== claimedFingerprint) {
    throw new Error("Native enrollment public-key fingerprint is invalid.");
  }
}

export function assertValidP256PointV1(publicKey: Uint8Array): void {
  if (publicKey.byteLength !== 65 || publicKey[0] !== 0x04) {
    throw new Error("Native enrollment P-256 public key is invalid.");
  }
  try {
    const verifier = createECDH("prime256v1");
    verifier.generateKeys();
    const secret = new Uint8Array(verifier.computeSecret(publicKey));
    if (secret.every((value) => value === 0)) throw new Error("zero secret");
  } catch {
    throw new Error("Native enrollment P-256 public key is invalid.");
  }
}

function decodeCanonicalPublicKey(value: string): Uint8Array {
  if (!/^B[A-P][A-Za-z0-9_-]{84}[AEIMQUYcgkosw048]$/u.test(value)) {
    throw new Error("Native enrollment P-256 public key is invalid.");
  }
  return new Uint8Array(Buffer.from(value, "base64url"));
}
