import { createHash, timingSafeEqual } from "node:crypto";

import {
  assertAppAttestRegistrationChallengeV1,
  canonicalJsonBytes,
  type AppAttestAssertionResponseV1,
  type AppAttestRegistrationResponseV1,
  type NativeEnrollmentPossessionProofV1,
} from "@vault/shared-types";

import {
  verifyAppAttestRegistrationV1,
  type AppAttestCertificateTrustV1,
  type VerifiedAppAttestRegistrationV1,
} from "./app-attest-verifier.js";
import {
  verifyNativeEnrollmentAcceptanceEvidenceV1,
  type NativeEnrollmentAcceptanceEvidenceV1,
} from "./native-enrollment-acceptance-verifier.js";
import type { NativeEnrollmentTransactionClientV1 } from "./native-enrollment-transaction-client.js";
import type { ServerEphemeralKeyCustodyV1 } from "./server-ephemeral-key-custody.js";

export async function completeAppAttestRegistrationV1(input: Readonly<{
  challengeId: string;
  claimantUserId: string;
  idempotencyKey: string;
  now?: Date;
  portalSessionId: string;
  response: AppAttestRegistrationResponseV1;
  transactions: NativeEnrollmentTransactionClientV1;
  trust: AppAttestCertificateTrustV1;
  verifyRegistration?: typeof verifyAppAttestRegistrationV1;
}>) {
  const stored = await input.transactions.getRegistrationChallenge(input);
  const challengeBytes = decode(stored.challengeBytesBase64Url);
  assertDigest(challengeBytes, stored.challengeBytesDigest);
  const challenge = assertAppAttestRegistrationChallengeV1(parseJson(challengeBytes));
  assertCanonical(challengeBytes, canonicalJsonBytes(challenge as never));
  if (challenge.challenge_id !== input.challengeId || challenge.claimant_id !== input.claimantUserId ||
      challenge.portal_session_id !== input.portalSessionId) fail();
  const verified = await (input.verifyRegistration ?? verifyAppAttestRegistrationV1)({
    challenge, challengeBytes, now: input.now, response: input.response, trust: input.trust,
  });
  assertVerifiedRegistrationBinding(verified, challenge.app_attest_key_id_digest);
  return input.transactions.consumeRegistration({
    challengeBytesDigest: stored.challengeBytesDigest, challengeId: input.challengeId,
    claimantUserId: input.claimantUserId, idempotencyKey: input.idempotencyKey,
    portalSessionId: input.portalSessionId, verified,
  });
}

export async function completeNativeEnrollmentV1(input: Readonly<{
  appAttestChallengeId: string;
  appAttestResponse: AppAttestAssertionResponseV1;
  claimantUserId: string;
  custody: ServerEphemeralKeyCustodyV1;
  idempotencyKey: string;
  nativeChallengeId: string;
  now?: Date;
  portalSessionId: string;
  possessionProof: NativeEnrollmentPossessionProofV1;
  transactions: NativeEnrollmentTransactionClientV1;
  verifyAcceptance?: typeof verifyNativeEnrollmentAcceptanceEvidenceV1;
}>) {
  const stored = await input.transactions.getNativeEvidence(input);
  const evidence = (input.verifyAcceptance ?? verifyNativeEnrollmentAcceptanceEvidenceV1)({
    appAttestResponse: input.appAttestResponse, possessionProof: input.possessionProof, stored,
  }, { custody: input.custody, now: input.now });
  assertAcceptanceEvidence(evidence);
  return input.transactions.acceptNativeEnrollment({
    appAttestChallengeId: input.appAttestChallengeId, claimantUserId: input.claimantUserId,
    evidence, idempotencyKey: input.idempotencyKey, nativeChallengeId: input.nativeChallengeId,
    portalSessionId: input.portalSessionId,
  });
}

function assertVerifiedRegistrationBinding(verified: VerifiedAppAttestRegistrationV1, expectedDigest: string) {
  if (verified.appAttestKeyIdDigest !== expectedDigest) fail();
}
function assertAcceptanceEvidence(evidence: NativeEnrollmentAcceptanceEvidenceV1) {
  if (evidence.verifiedAppAttestCounter <= evidence.expectedAppAttestCounter) fail();
}
function decode(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) fail();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength < 16 || decoded.byteLength > 8_192 || decoded.toString("base64url") !== value) fail();
  return decoded;
}
function parseJson(value: Uint8Array): unknown { try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(value)); } catch { fail(); } }
function assertDigest(value: Uint8Array, expected: string) { assertCanonical(createHash("sha256").update(value).digest(), Buffer.from(expected, "base64url")); }
function assertCanonical(left: Uint8Array, right: Uint8Array) { if (left.byteLength !== right.byteLength || !timingSafeEqual(left, right)) fail(); }
function fail(): never { throw new Error("Native enrollment service verification failed."); }
