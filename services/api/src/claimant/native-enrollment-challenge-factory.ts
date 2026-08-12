import { createECDH, createHash, randomBytes, randomUUID } from "node:crypto";

import {
  APP_ATTEST_ASSERTION_PROTOCOL_V1,
  APP_ATTEST_REGISTRATION_PROTOCOL_V1,
  NATIVE_ENROLLMENT_PROTOCOL_V1,
  assertAppAttestAssertionChallengeV1,
  assertAppAttestRegistrationChallengeV1,
  assertNativeEnrollmentChallengeV1,
  canonicalJsonBytes,
  type AppAttestEnvironmentV1,
  type AppAttestValidationCategoryV1,
} from "@vault/shared-types";

import { deriveNativeEnrollmentPublicKeyFingerprintV1 } from "./native-enrollment-verifier-contract.js";
import type { ServerEphemeralKeyCustodyV1 } from "./server-ephemeral-key-custody.js";

type FactoryDependencies = Readonly<{
  generateEphemeralKey?: () => Readonly<{ privateKey: Uint8Array; publicKey: Uint8Array }>;
  now?: () => Date;
  random32?: () => Uint8Array;
  randomUuid?: () => string;
}>;

type AppBinding = Readonly<{
  appAttestKeyIdDigest: string;
  appIdHash: string;
  environment: AppAttestEnvironmentV1;
  requiredBundleVersion: string;
  requiredValidationCategory: AppAttestValidationCategoryV1;
}>;

export function createAppAttestRegistrationChallengeMaterialV1(input: AppBinding & Readonly<{
  apiAudience: string;
  claimantUserId: string;
  portalSessionId: string;
}>, dependencies: FactoryDependencies = {}) {
  const issuedAt = (dependencies.now ?? (() => new Date()))();
  const challenge = assertAppAttestRegistrationChallengeV1({
    api_audience: input.apiAudience,
    app_attest_key_id_digest: input.appAttestKeyIdDigest,
    app_id_hash: input.appIdHash,
    challenge_id: (dependencies.randomUuid ?? randomUUID)(),
    claimant_id: input.claimantUserId,
    environment: input.environment,
    expires_at: new Date(issuedAt.getTime() + 300_000).toISOString(),
    issued_at: issuedAt.toISOString(),
    nonce: encode32((dependencies.random32 ?? (() => randomBytes(32)))()),
    portal_session_id: input.portalSessionId,
    protocol: APP_ATTEST_REGISTRATION_PROTOCOL_V1,
    required_bundle_version: input.requiredBundleVersion,
    required_validation_category: input.requiredValidationCategory,
  });
  const challengeBytes = canonicalJsonBytes(challenge as never);
  return { challenge, challengeBytesBase64Url: Buffer.from(challengeBytes).toString("base64url"), challengeBytesDigest: digest(challengeBytes) };
}

export function createNativeEnrollmentChallengeMaterialV1(input: AppBinding & Readonly<{
  apiAudience: string;
  claimantPublicKeyBase64Url: string;
  claimantUserId: string;
  custody: ServerEphemeralKeyCustodyV1;
  deviceBindingDigest: string;
  eligibilityVersion: number;
  invitationId: string;
  invitationVersion: number;
  policyPackId: string;
  policyPackVersion: number;
  portalSessionId: string;
}>, dependencies: FactoryDependencies = {}) {
  const issuedAt = (dependencies.now ?? (() => new Date()))();
  const uuid = dependencies.randomUuid ?? randomUUID;
  const bytes32 = dependencies.random32 ?? (() => randomBytes(32));
  const nativeChallengeId = uuid(); const appAttestChallengeId = uuid(); const claimantKeyId = uuid();
  const ephemeral = (dependencies.generateEphemeralKey ?? generateEphemeralKey)();
  if (ephemeral.privateKey.byteLength !== 32 || ephemeral.publicKey.byteLength !== 65) fail();
  const expiresAt = new Date(issuedAt.getTime() + 300_000).toISOString();
  const nativeChallenge = assertNativeEnrollmentChallengeV1({
    challenge_id: nativeChallengeId, claimant_id: input.claimantUserId,
    claimant_key_id: claimantKeyId, claimant_key_version: 1,
    device_binding_digest: input.deviceBindingDigest, eligibility_version: input.eligibilityVersion,
    expires_at: expiresAt, invitation_reference: input.invitationId,
    invitation_version: input.invitationVersion, issued_at: issuedAt.toISOString(),
    kdf_salt: encode32(bytes32()), nonce: encode32(bytes32()), origin: input.apiAudience,
    policy_pack_id: input.policyPackId, policy_pack_version: input.policyPackVersion,
    protocol: NATIVE_ENROLLMENT_PROTOCOL_V1,
    public_key_fingerprint: deriveNativeEnrollmentPublicKeyFingerprintV1(input.claimantPublicKeyBase64Url),
    server_ephemeral_public_key: Buffer.from(ephemeral.publicKey).toString("base64url"),
  });
  const nativeBytes = canonicalJsonBytes(nativeChallenge as never); const nativeDigest = digest(nativeBytes);
  const appAttestChallenge = assertAppAttestAssertionChallengeV1({
    api_audience: input.apiAudience, app_attest_key_id_digest: input.appAttestKeyIdDigest,
    app_id_hash: input.appIdHash, challenge_id: appAttestChallengeId,
    claimant_id: input.claimantUserId, claimant_key_id: claimantKeyId, claimant_key_version: 1,
    environment: input.environment, expires_at: expiresAt, invitation_reference: input.invitationId,
    invitation_version: input.invitationVersion, issued_at: issuedAt.toISOString(),
    native_enrollment_challenge_digest: nativeDigest, nonce: encode32(bytes32()),
    portal_session_id: input.portalSessionId, protocol: APP_ATTEST_ASSERTION_PROTOCOL_V1,
    public_key_fingerprint: nativeChallenge.public_key_fingerprint,
    required_bundle_version: input.requiredBundleVersion,
    required_validation_category: input.requiredValidationCategory,
  });
  const appBytes = canonicalJsonBytes(appAttestChallenge as never);
  const publicKey = Buffer.from(input.claimantPublicKeyBase64Url, "base64url");
  const envelope = input.custody.seal({ claimantUserId: input.claimantUserId,
    nativeChallengeId, privateKey: ephemeral.privateKey });
  ephemeral.privateKey.fill(0);
  return {
    appAttestChallenge, appAttestChallengeBytesBase64Url: Buffer.from(appBytes).toString("base64url"),
    appAttestChallengeBytesDigest: digest(appBytes), claimantKeyId,
    claimantPublicKeyBase64Url: input.claimantPublicKeyBase64Url,
    nativeChallenge, nativeChallengeBytesBase64Url: Buffer.from(nativeBytes).toString("base64url"),
    nativeChallengeBytesDigest: nativeDigest,
    publicKeyJwk: { crv: "P-256" as const, kty: "EC" as const,
      x: publicKey.subarray(1, 33).toString("base64url"), y: publicKey.subarray(33).toString("base64url") },
    serverEphemeralPrivateKeyEnvelope: envelope,
  };
}

function generateEphemeralKey() {
  const ecdh = createECDH("prime256v1"); ecdh.generateKeys();
  return { privateKey: ecdh.getPrivateKey(), publicKey: ecdh.getPublicKey() };
}
function encode32(value: Uint8Array): string { if (value.byteLength !== 32) fail(); return Buffer.from(value).toString("base64url"); }
function digest(value: Uint8Array): string { return createHash("sha256").update(value).digest("base64url"); }
function fail(): never { throw new Error("Native enrollment challenge generation failed."); }
