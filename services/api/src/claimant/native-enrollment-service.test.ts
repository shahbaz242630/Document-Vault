import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";
import type { AppAttestSyntheticFixtureV1, NativeEnrollmentSyntheticFixtureV1 } from "@vault/shared-types";

import { completeAppAttestRegistrationV1, completeNativeEnrollmentV1 } from "./native-enrollment-service.js";
import type { NativeEnrollmentTransactionClientV1 } from "./native-enrollment-transaction-client.js";

const app = JSON.parse(readFileSync(fileURLToPath(new URL(
  "../../../../packages/shared-types/test-vectors/claim/app-attest-binding-v1.json", import.meta.url,
)), "utf8")) as AppAttestSyntheticFixtureV1 & { registration_client_data: string; registration_client_data_hash: string };
const native = JSON.parse(readFileSync(fileURLToPath(new URL(
  "../../../../packages/shared-types/test-vectors/claim/native-enrollment-proof-v1.json", import.meta.url,
)), "utf8")) as NativeEnrollmentSyntheticFixtureV1;

describe("native enrollment service", () => {
  it("verifies the exact stored canonical registration transcript before consuming it", async () => {
    const consumeRegistration = vi.fn(async () => ({ appAttestKeyRecordId: "91000000-0000-4000-8000-000000000019", assertionCounter: 0, challengeId: app.registration_challenge.challenge_id, replayed: false }));
    const transactions = client({ consumeRegistration, getRegistrationChallenge: vi.fn(async () => ({
      challengeBytesBase64Url: app.registration_client_data, challengeBytesDigest: app.registration_client_data_hash,
    })) });
    const verifyRegistration = vi.fn(async () => ({
      appAttestKeyIdDigest: app.registration_challenge.app_attest_key_id_digest,
      bundleVersion: "1", environment: "production" as const, publicKeySpkiBase64: "QQ==",
      receiptBase64: "cg==", validationCategory: 2 as const,
    }));
    await completeAppAttestRegistrationV1({ challengeId: app.registration_challenge.challenge_id,
      claimantUserId: app.registration_challenge.claimant_id, idempotencyKey: "71000000-0000-4000-8000-000000000004",
      portalSessionId: app.registration_challenge.portal_session_id, response: app.registration_response,
      transactions, trust: { verifyCertificateChain: vi.fn() }, verifyRegistration });
    expect(verifyRegistration).toHaveBeenCalledOnce(); expect(consumeRegistration).toHaveBeenCalledOnce();
  });

  it("does not consume registration when stored bytes or verified key binding changes", async () => {
    const consumeRegistration = vi.fn();
    const transactions = client({ consumeRegistration, getRegistrationChallenge: vi.fn(async () => ({
      challengeBytesBase64Url: `${app.registration_client_data}A`, challengeBytesDigest: app.registration_client_data_hash,
    })) });
    await expect(completeAppAttestRegistrationV1({ challengeId: app.registration_challenge.challenge_id,
      claimantUserId: app.registration_challenge.claimant_id, idempotencyKey: "71000000-0000-4000-8000-000000000004",
      portalSessionId: app.registration_challenge.portal_session_id, response: app.registration_response,
      transactions, trust: { verifyCertificateChain: vi.fn() }, verifyRegistration: vi.fn(),
    })).rejects.toThrow("service verification failed");
    expect(consumeRegistration).not.toHaveBeenCalled();
  });

  it("loads stored native evidence, verifies both proofs, then forwards only derived acceptance evidence", async () => {
    const acceptNativeEnrollment = vi.fn(async () => ({ assertionCounter: 5,
      caseId: "91000000-0000-4000-8000-000000000019", caseVersion: 1,
      claimantKeyId: native.challenge.claimant_key_id, invitationId: native.challenge.invitation_reference,
      invitationVersion: 2, replayed: false }));
    const stored = { appAttestChallengeBytesBase64Url: "A", appAttestChallengeBytesDigest: "A".repeat(43),
      appAttestChallengeId: app.assertion_challenge.challenge_id, appAttestKeyIdDigest: app.assertion_challenge.app_attest_key_id_digest,
      appAttestPublicKeySpkiBase64: "QQ==", claimantPublicKeyBase64Url: native.challenge_request.public_key,
      claimantUserId: native.challenge.claimant_id, nativeChallengeBytesBase64Url: native.challenge_bytes,
      nativeChallengeBytesDigest: app.assertion_challenge.native_enrollment_challenge_digest,
      nativeChallengeId: native.challenge.challenge_id, previousAppAttestCounter: 4,
      serverEphemeralPrivateKeyEnvelope: "v1.synthetic.envelope.material" };
    const transactions = client({ acceptNativeEnrollment, getNativeEvidence: vi.fn(async () => stored) });
    const verifyAcceptance = vi.fn(() => ({ expectedAppAttestCounter: 4,
      verifiedAppAttestChallengeDigest: "A".repeat(43), verifiedAppAttestCounter: 5,
      verifiedBundleVersion: "1", verifiedNativeChallengeDigest: stored.nativeChallengeBytesDigest,
      verifiedValidationCategory: 2 as const }));
    await completeNativeEnrollmentV1({ appAttestChallengeId: app.assertion_challenge.challenge_id,
      appAttestResponse: app.assertion_response, claimantUserId: native.challenge.claimant_id,
      custody: { open: vi.fn(), seal: vi.fn() }, idempotencyKey: "71000000-0000-4000-8000-000000000004",
      nativeChallengeId: native.challenge.challenge_id, portalSessionId: app.assertion_challenge.portal_session_id,
      possessionProof: native.possession_proof, transactions, verifyAcceptance });
    expect(verifyAcceptance).toHaveBeenCalledOnce(); expect(acceptNativeEnrollment).toHaveBeenCalledOnce();
  });
});

function client(overrides: Partial<NativeEnrollmentTransactionClientV1>): NativeEnrollmentTransactionClientV1 {
  const unavailable = async () => { throw new Error("unexpected transaction call"); };
  return { acceptNativeEnrollment: unavailable, consumeRegistration: unavailable,
    getNativeEvidence: unavailable, getRegistrationChallenge: unavailable,
    issueNativeChallenge: unavailable, issueRegistrationChallenge: unavailable, ...overrides } as NativeEnrollmentTransactionClientV1;
}
