import { createHash, timingSafeEqual } from "node:crypto";

import {
  assertAppAttestAssertionChallengeV1,
  assertNativeEnrollmentChallengeV1,
  type AppAttestAssertionResponseV1,
  type NativeEnrollmentPossessionProofV1,
} from "@vault/shared-types";

import {
  verifyAppAttestAssertionV1,
  type VerifiedAppAttestAssertionV1,
} from "./app-attest-verifier.js";
import { verifyNativeEnrollmentPossessionV1 } from "./native-enrollment-possession-verifier.js";
import type { ServerEphemeralKeyCustodyV1 } from "./server-ephemeral-key-custody.js";

export type StoredNativeEnrollmentEvidenceV1 = Readonly<{
  appAttestChallengeBytesBase64Url: string;
  appAttestChallengeBytesDigest: string;
  appAttestChallengeId: string;
  appAttestKeyIdDigest: string;
  appAttestPublicKeySpkiBase64: string;
  claimantPublicKeyBase64Url: string;
  claimantUserId: string;
  nativeChallengeBytesBase64Url: string;
  nativeChallengeBytesDigest: string;
  nativeChallengeId: string;
  previousAppAttestCounter: number;
  serverEphemeralPrivateKeyEnvelope: string;
}>;

export type NativeEnrollmentAcceptanceEvidenceV1 = Readonly<{
  expectedAppAttestCounter: number;
  verifiedAppAttestChallengeDigest: string;
  verifiedAppAttestCounter: number;
  verifiedBundleVersion: string;
  verifiedNativeChallengeDigest: string;
  verifiedValidationCategory: 2 | 3 | 4;
}>;

type VerifierDependencies = Readonly<{
  custody: ServerEphemeralKeyCustodyV1;
  now?: Date;
  verifyAppAssertion?: typeof verifyAppAttestAssertionV1;
  verifyPossession?: typeof verifyNativeEnrollmentPossessionV1;
}>;

export function verifyNativeEnrollmentAcceptanceEvidenceV1(input: Readonly<{
  appAttestResponse: AppAttestAssertionResponseV1;
  possessionProof: NativeEnrollmentPossessionProofV1;
  stored: StoredNativeEnrollmentEvidenceV1;
}>, dependencies: VerifierDependencies): NativeEnrollmentAcceptanceEvidenceV1 {
  const nativeBytes = decodeCanonicalBase64Url(input.stored.nativeChallengeBytesBase64Url, 16, 8_192);
  const appBytes = decodeCanonicalBase64Url(input.stored.appAttestChallengeBytesBase64Url, 16, 8_192);
  const nativeDigest = digest(nativeBytes); const appDigest = digest(appBytes);
  assertDigest(nativeDigest, input.stored.nativeChallengeBytesDigest);
  assertDigest(appDigest, input.stored.appAttestChallengeBytesDigest);
  const nativeChallenge = assertNativeEnrollmentChallengeV1(parseJson(nativeBytes));
  const appChallenge = assertAppAttestAssertionChallengeV1(parseJson(appBytes));
  assertStoredBindings(input.stored, nativeChallenge, appChallenge, nativeDigest);
  const privateKey = dependencies.custody.open({
    claimantUserId: input.stored.claimantUserId,
    envelope: input.stored.serverEphemeralPrivateKeyEnvelope,
    nativeChallengeId: input.stored.nativeChallengeId,
  });
  try {
    (dependencies.verifyPossession ?? verifyNativeEnrollmentPossessionV1)({
      challenge: nativeChallenge, claimantPublicKeyBase64Url: input.stored.claimantPublicKeyBase64Url,
      now: dependencies.now, proof: input.possessionProof, serverEphemeralPrivateKey: privateKey,
    });
  } finally { privateKey.fill(0); }
  const app = (dependencies.verifyAppAssertion ?? verifyAppAttestAssertionV1)({
    challenge: appChallenge, challengeBytes: appBytes, now: dependencies.now,
    previousCounter: input.stored.previousAppAttestCounter,
    publicKeySpkiBase64: input.stored.appAttestPublicKeySpkiBase64,
    response: input.appAttestResponse,
  });
  return {
    expectedAppAttestCounter: input.stored.previousAppAttestCounter,
    verifiedAppAttestChallengeDigest: appDigest,
    verifiedAppAttestCounter: app.counter,
    verifiedBundleVersion: app.bundleVersion,
    verifiedNativeChallengeDigest: nativeDigest,
    verifiedValidationCategory: app.validationCategory,
  };
}

function assertStoredBindings(
  stored: StoredNativeEnrollmentEvidenceV1,
  native: ReturnType<typeof assertNativeEnrollmentChallengeV1>,
  app: ReturnType<typeof assertAppAttestAssertionChallengeV1>,
  nativeDigest: string,
) {
  for (const [left, right] of [
    [stored.nativeChallengeId, native.challenge_id], [stored.appAttestChallengeId, app.challenge_id],
    [stored.claimantUserId, native.claimant_id], [stored.claimantUserId, app.claimant_id],
    [stored.appAttestKeyIdDigest, app.app_attest_key_id_digest],
    [native.claimant_key_id, app.claimant_key_id], [native.claimant_key_version, app.claimant_key_version],
    [native.invitation_reference, app.invitation_reference], [native.invitation_version, app.invitation_version],
    [native.public_key_fingerprint, app.public_key_fingerprint],
    [nativeDigest, app.native_enrollment_challenge_digest], [native.origin, app.api_audience],
  ] as const) if (left !== right) fail();
}

function decodeCanonicalBase64Url(value: string, minimum: number, maximum: number): Buffer {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) fail();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength < minimum || decoded.byteLength > maximum || decoded.toString("base64url") !== value) fail();
  return decoded;
}
function parseJson(value: Uint8Array): unknown { try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(value)); } catch { fail(); } }
function digest(value: Uint8Array): string { return createHash("sha256").update(value).digest("base64url"); }
function assertDigest(actual: string, expected: string) {
  const left = Buffer.from(actual, "base64url"); const right = Buffer.from(expected, "base64url");
  if (left.byteLength !== right.byteLength || !timingSafeEqual(left, right)) fail();
}
function fail(): never { throw new Error("Native enrollment acceptance evidence is invalid."); }

export type { VerifiedAppAttestAssertionV1 };
