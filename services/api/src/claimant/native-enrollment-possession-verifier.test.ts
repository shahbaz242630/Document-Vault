import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import type { NativeEnrollmentSyntheticFixtureV1 } from "@vault/shared-types";

import { verifyNativeEnrollmentPossessionV1 } from "./native-enrollment-possession-verifier.js";

type Vector = NativeEnrollmentSyntheticFixtureV1 & Readonly<{
  synthetic_key_material: Readonly<{ claimant_public_key: string; server_ephemeral_private_scalar: string }>;
}>;
const vector = JSON.parse(readFileSync(fileURLToPath(new URL(
  "../../../../packages/shared-types/test-vectors/claim/native-enrollment-proof-v1.json",
  import.meta.url,
)), "utf8")) as Vector;

describe("native enrollment possession verifier", () => {
  it("verifies the frozen ECDH/HKDF/HMAC vector and returns only public persistence material", () => {
    const result = verifyNativeEnrollmentPossessionV1({
      challenge: vector.challenge,
      claimantPublicKeyBase64Url: vector.synthetic_key_material.claimant_public_key,
      now: new Date("2026-07-28T08:01:00.000Z"),
      proof: vector.possession_proof,
      serverEphemeralPrivateKey: Buffer.from(vector.synthetic_key_material.server_ephemeral_private_scalar, "base64url"),
    });
    expect(result.challengeDigest).toHaveLength(43);
    expect(result.publicKeyJwk).toEqual(expect.objectContaining({ crv: "P-256", kty: "EC" }));
    expect(result.publicKeyJwk).not.toHaveProperty("d");
  });

  it("rejects expiry, changed proof, wrong ephemeral custody, and off-curve claimant keys", () => {
    const base = {
      challenge: vector.challenge, claimantPublicKeyBase64Url: vector.synthetic_key_material.claimant_public_key,
      now: new Date("2026-07-28T08:01:00.000Z"), proof: vector.possession_proof,
      serverEphemeralPrivateKey: Buffer.from(vector.synthetic_key_material.server_ephemeral_private_scalar, "base64url"),
    };
    expect(() => verifyNativeEnrollmentPossessionV1({ ...base, now: new Date(vector.challenge.expires_at) })).toThrow("verification failed");
    expect(() => verifyNativeEnrollmentPossessionV1({ ...base, proof: { ...vector.possession_proof, proof_mac: "A".repeat(43) } })).toThrow("verification failed");
    expect(() => verifyNativeEnrollmentPossessionV1({ ...base, serverEphemeralPrivateKey: Buffer.alloc(32, 9) })).toThrow("verification failed");
    const offCurve = Buffer.alloc(65); offCurve[0] = 4;
    expect(() => verifyNativeEnrollmentPossessionV1({ ...base, claimantPublicKeyBase64Url: offCurve.toString("base64url") })).toThrow();
  });
});
