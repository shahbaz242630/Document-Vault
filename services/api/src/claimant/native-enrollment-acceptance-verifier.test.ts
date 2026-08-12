import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";
import type { AppAttestSyntheticFixtureV1, NativeEnrollmentSyntheticFixtureV1 } from "@vault/shared-types";

import { verifyNativeEnrollmentAcceptanceEvidenceV1 } from "./native-enrollment-acceptance-verifier.js";

const native = JSON.parse(readFileSync(fileURLToPath(new URL(
  "../../../../packages/shared-types/test-vectors/claim/native-enrollment-proof-v1.json", import.meta.url,
)), "utf8")) as NativeEnrollmentSyntheticFixtureV1;
const app = JSON.parse(readFileSync(fileURLToPath(new URL(
  "../../../../packages/shared-types/test-vectors/claim/app-attest-binding-v1.json", import.meta.url,
)), "utf8")) as AppAttestSyntheticFixtureV1 & { assertion_client_data: string; assertion_client_data_hash: string };

const stored = {
  appAttestChallengeBytesBase64Url: app.assertion_client_data,
  appAttestChallengeBytesDigest: app.assertion_client_data_hash,
  appAttestChallengeId: app.assertion_challenge.challenge_id,
  appAttestKeyIdDigest: app.assertion_challenge.app_attest_key_id_digest,
  appAttestPublicKeySpkiBase64: "synthetic-spki",
  claimantPublicKeyBase64Url: native.challenge_request.public_key,
  claimantUserId: native.challenge.claimant_id,
  nativeChallengeBytesBase64Url: native.challenge_bytes,
  nativeChallengeBytesDigest: app.assertion_challenge.native_enrollment_challenge_digest,
  nativeChallengeId: native.challenge.challenge_id,
  previousAppAttestCounter: 4,
  serverEphemeralPrivateKeyEnvelope: "synthetic-envelope",
} as const;

describe("native enrollment acceptance evidence coordinator", () => {
  it("binds both stored challenge transcripts before returning database finalize input", () => {
    const privateKey = Buffer.alloc(32, 7);
    const custody = { open: vi.fn(() => privateKey), seal: vi.fn() };
    const verifyPossession = vi.fn(() => ({ challengeDigest: stored.nativeChallengeBytesDigest,
      publicKeyJwk: { crv: "P-256" as const, kty: "EC" as const, x: "A".repeat(43), y: "B".repeat(43) } }));
    const verifyAppAssertion = vi.fn(() => ({ bundleVersion: "1", counter: 5, validationCategory: 2 as const }));
    const result = verifyNativeEnrollmentAcceptanceEvidenceV1({
      appAttestResponse: app.assertion_response, possessionProof: native.possession_proof, stored,
    }, { custody, now: new Date("2026-07-28T08:11:00.000Z"), verifyAppAssertion, verifyPossession });
    expect(result).toEqual({ expectedAppAttestCounter: 4,
      verifiedAppAttestChallengeDigest: app.assertion_client_data_hash,
      verifiedAppAttestCounter: 5, verifiedBundleVersion: "1",
      verifiedNativeChallengeDigest: stored.nativeChallengeBytesDigest, verifiedValidationCategory: 2 });
    expect(privateKey.every((value) => value === 0)).toBe(true);
    expect(verifyPossession).toHaveBeenCalledOnce(); expect(verifyAppAssertion).toHaveBeenCalledOnce();
  });

  it("rejects altered stored bytes or cross-challenge bindings before cryptography", () => {
    const dependencies = { custody: { open: vi.fn(), seal: vi.fn() },
      verifyAppAssertion: vi.fn(), verifyPossession: vi.fn() };
    for (const changed of [
      { ...stored, nativeChallengeBytesBase64Url: `${stored.nativeChallengeBytesBase64Url}A` },
      { ...stored, claimantUserId: "21000000-0000-4000-8000-000000000003" },
      { ...stored, appAttestChallengeId: "71000000-0000-4000-8000-000000000003" },
    ]) expect(() => verifyNativeEnrollmentAcceptanceEvidenceV1({
      appAttestResponse: app.assertion_response, possessionProof: native.possession_proof, stored: changed,
    }, dependencies)).toThrow("evidence is invalid");
    expect(dependencies.custody.open).not.toHaveBeenCalled();
  });
});
