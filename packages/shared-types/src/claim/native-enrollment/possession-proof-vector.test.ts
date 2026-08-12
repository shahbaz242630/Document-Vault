import { createECDH, createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { canonicalJson, type CanonicalJsonValue } from "../canonical-json";
import type { NativeEnrollmentChallengeV1, NativeEnrollmentSyntheticFixtureV1 } from "./contracts";
import {
  NATIVE_ENROLLMENT_PROOF_KEY_LABEL_V1,
  NATIVE_ENROLLMENT_PROOF_MAC_LABEL_V1,
  NATIVE_ENROLLMENT_PUBLIC_KEY_FINGERPRINT_LABEL_V1,
} from "./protocol";
import { assertNativeEnrollmentFixtureV1 } from "./validation";

type Vector = NativeEnrollmentSyntheticFixtureV1 & {
  meta: { production_data: false; synthetic_only: true };
  synthetic_key_material: {
    claimant_private_scalar: string;
    claimant_public_key: string;
    server_ephemeral_private_scalar: string;
  };
  challenge_bytes: string;
  challenge_digest: string;
  proof_key_info: string;
  expected_shared_secret: string;
  expected_proof_key: string;
  proof_mac_input: string;
};

const vectorPath = fileURLToPath(
  new URL("../../../test-vectors/claim/native-enrollment-proof-v1.json", import.meta.url),
);
const fixture = JSON.parse(readFileSync(vectorPath, "utf8")) as Vector;

describe("native enrollment possession proof V1 vector", () => {
  it("matches RFC 5869 SHA-256 test case 1 independently of the generated claim vector", () => {
    const output = hkdfSha256(
      fromHex("0b".repeat(22)),
      fromHex("000102030405060708090a0b0c"),
      fromHex("f0f1f2f3f4f5f6f7f8f9"),
      42,
    );
    expect(Buffer.from(output).toString("hex")).toBe(
      "3cb25f25faacd57a90434f64d0362f2a" +
      "2d2d0a90cf1a5a4c5db02d56ecc4c5bf" +
      "34007208d5b887185865",
    );
  });

  it("reproduces the exact fingerprint, transcript, ECDH, HKDF, and HMAC", () => {
    expect(fixture.meta).toMatchObject({ production_data: false, synthetic_only: true });
    expect(assertNativeEnrollmentFixtureV1({
      challenge: fixture.challenge,
      challenge_bytes: fixture.challenge_bytes,
      challenge_request: fixture.challenge_request,
      possession_proof: fixture.possession_proof,
    })).toEqual({
      challenge: fixture.challenge,
      challenge_bytes: fixture.challenge_bytes,
      challenge_request: fixture.challenge_request,
      possession_proof: fixture.possession_proof,
    });

    const claimantPublicKey = decode(fixture.synthetic_key_material.claimant_public_key);
    const fingerprint = sha256(concat(
      utf8(NATIVE_ENROLLMENT_PUBLIC_KEY_FINGERPRINT_LABEL_V1),
      Uint8Array.of(0),
      claimantPublicKey,
    ));
    expect(encode(fingerprint)).toBe(fixture.challenge.public_key_fingerprint);

    const canonical = utf8(canonicalJson(fixture.challenge as unknown as CanonicalJsonValue));
    expect(encode(canonical)).toBe(fixture.challenge_bytes);
    const challengeDigest = sha256(canonical);
    expect(encode(challengeDigest)).toBe(fixture.challenge_digest);

    const proofKeyInfo = concat(
      utf8(NATIVE_ENROLLMENT_PROOF_KEY_LABEL_V1), Uint8Array.of(0), challengeDigest,
    );
    expect(encode(proofKeyInfo)).toBe(fixture.proof_key_info);
    const sharedSecret = ecdh(
      decode(fixture.synthetic_key_material.claimant_private_scalar),
      decode(fixture.challenge.server_ephemeral_public_key),
    );
    expect(encode(sharedSecret)).toBe(fixture.expected_shared_secret);
    const proofKey = hkdfSha256(sharedSecret, decode(fixture.challenge.kdf_salt), proofKeyInfo, 32);
    expect(encode(proofKey)).toBe(fixture.expected_proof_key);
    const macInput = concat(
      utf8(NATIVE_ENROLLMENT_PROOF_MAC_LABEL_V1), Uint8Array.of(0), canonical,
    );
    expect(encode(macInput)).toBe(fixture.proof_mac_input);
    expect(encode(hmacSha256(proofKey, macInput))).toBe(fixture.possession_proof.proof_mac);
  });

  it("rejects the reference MAC after every security-relevant challenge binding is changed", () => {
    const mutations: Partial<Record<keyof NativeEnrollmentChallengeV1, unknown>>[] = [
      { protocol: "sanduqkin:claim:native-enrollment:v2" },
      { challenge_id: "61000000-0000-4000-8000-000000000017" },
      { claimant_id: "21000000-0000-4000-8000-000000000003" },
      { claimant_key_id: "31000000-0000-4000-8000-000000000014" },
      { claimant_key_version: 2 },
      { device_binding_digest: "22".repeat(32) },
      { eligibility_version: 4 },
      { expires_at: "2026-07-28T08:04:59.000Z" },
      { invitation_reference: "51000000-0000-4000-8000-000000000006" },
      { invitation_version: 3 },
      { issued_at: "2026-07-28T08:00:01.000Z" },
      { kdf_salt: encode(Uint8Array.from({ length: 32 }, (_, i) => i + 99)) },
      { nonce: encode(Uint8Array.from({ length: 32 }, (_, i) => i + 131)) },
      { origin: "https://other.sanduqkin.test" },
      { policy_pack_id: "death-only-v2" },
      { policy_pack_version: 5 },
      { public_key_fingerprint: "A".repeat(43) },
      { server_ephemeral_public_key: fixture.challenge_request.public_key },
    ];

    const expected = decode(fixture.possession_proof.proof_mac);
    for (const mutation of mutations) {
      const changed = { ...fixture.challenge, ...mutation } as NativeEnrollmentChallengeV1;
      const actual = macForChallenge(changed);
      expect(timingSafeEqual(actual, expected), JSON.stringify(mutation)).toBe(false);
    }
  });

  it("rejects a proof made by a different claimant private key", () => {
    const wrongPrivateKey = new Uint8Array(32);
    wrongPrivateKey[31] = 6;
    const actual = macForChallenge(fixture.challenge, wrongPrivateKey);
    expect(timingSafeEqual(actual, decode(fixture.possession_proof.proof_mac))).toBe(false);
  });

  it("requires the runtime crypto library to reject an off-curve P-256 point", () => {
    const offCurve = new Uint8Array(65);
    offCurve[0] = 0x04;
    expect(() => ecdh(
      decode(fixture.synthetic_key_material.claimant_private_scalar),
      offCurve,
    )).toThrow();
  });
});

function macForChallenge(
  challenge: NativeEnrollmentChallengeV1,
  privateKey = decode(fixture.synthetic_key_material.claimant_private_scalar),
): Uint8Array {
  const canonical = utf8(canonicalJson(challenge as unknown as CanonicalJsonValue));
  const info = concat(
    utf8(NATIVE_ENROLLMENT_PROOF_KEY_LABEL_V1), Uint8Array.of(0), sha256(canonical),
  );
  const shared = ecdh(privateKey, decode(challenge.server_ephemeral_public_key));
  const proofKey = hkdfSha256(shared, decode(challenge.kdf_salt), info, 32);
  return hmacSha256(proofKey, concat(
    utf8(NATIVE_ENROLLMENT_PROOF_MAC_LABEL_V1), Uint8Array.of(0), canonical,
  ));
}

function ecdh(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  const instance = createECDH("prime256v1");
  instance.setPrivateKey(privateKey);
  return new Uint8Array(instance.computeSecret(publicKey));
}

function hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  if (length < 0 || length > 255 * 32) throw new Error("HKDF output length exceeds RFC 5869 bounds.");
  const prk = hmacSha256(salt, ikm);
  let previous: Uint8Array<ArrayBufferLike> = new Uint8Array();
  let output: Uint8Array<ArrayBufferLike> = new Uint8Array();
  for (let counter = 1; output.length < length; counter += 1) {
    previous = hmacSha256(prk, concat(previous, info, Uint8Array.of(counter)));
    output = concat(output, previous);
  }
  return output.slice(0, length);
}

function sha256(value: Uint8Array): Uint8Array { return new Uint8Array(createHash("sha256").update(value).digest()); }
function hmacSha256(key: Uint8Array, value: Uint8Array): Uint8Array { return new Uint8Array(createHmac("sha256", key).update(value).digest()); }
function utf8(value: string): Uint8Array { return new TextEncoder().encode(value); }
function encode(value: Uint8Array): string { return Buffer.from(value).toString("base64url"); }
function decode(value: string): Uint8Array { return new Uint8Array(Buffer.from(value, "base64url")); }
function fromHex(value: string): Uint8Array { return new Uint8Array(Buffer.from(value, "hex")); }
function concat(...values: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(values.reduce((total, value) => total + value.length, 0));
  let offset = 0;
  for (const value of values) { output.set(value, offset); offset += value.length; }
  return output;
}
