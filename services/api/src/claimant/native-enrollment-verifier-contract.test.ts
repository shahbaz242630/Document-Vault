import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  assertNativeEnrollmentPublicKeyFingerprintV1,
  assertValidP256PointV1,
  deriveNativeEnrollmentPublicKeyFingerprintV1,
} from "./native-enrollment-verifier-contract.js";

const vector = JSON.parse(readFileSync(fileURLToPath(new URL(
  "../../../../packages/shared-types/test-vectors/claim/native-enrollment-proof-v1.json",
  import.meta.url,
)), "utf8")) as {
  challenge: { public_key_fingerprint: string };
  challenge_request: { public_key: string };
};

describe("native enrollment verifier contract", () => {
  it("recomputes and binds the claimant fingerprint server-side", () => {
    const publicKey = vector.challenge_request.public_key;
    const fingerprint = deriveNativeEnrollmentPublicKeyFingerprintV1(publicKey);
    expect(fingerprint).toBe(vector.challenge.public_key_fingerprint);
    expect(() => assertNativeEnrollmentPublicKeyFingerprintV1(publicKey, "A".repeat(43)))
      .toThrow("fingerprint is invalid");
  });

  it("rejects the identity encoding and a structurally valid off-curve point", () => {
    const identity = new Uint8Array(65);
    identity[0] = 0x04;
    expect(() => assertValidP256PointV1(identity)).toThrow("P-256 public key is invalid");

    const valid = new Uint8Array(Buffer.from(
      vector.challenge_request.public_key,
      "base64url",
    ));
    const offCurve = valid.slice();
    offCurve[64] ^= 0x01;
    expect(() => assertValidP256PointV1(offCurve)).toThrow("P-256 public key is invalid");
  });
});
