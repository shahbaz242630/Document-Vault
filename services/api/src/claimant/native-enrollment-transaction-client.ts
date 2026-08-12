import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

import type { NativeEnrollmentAcceptanceEvidenceV1, StoredNativeEnrollmentEvidenceV1 } from "./native-enrollment-acceptance-verifier.js";
import type { createAppAttestRegistrationChallengeMaterialV1, createNativeEnrollmentChallengeMaterialV1 } from "./native-enrollment-challenge-factory.js";
import type { VerifiedAppAttestRegistrationV1 } from "./app-attest-verifier.js";

type RpcResult = PromiseLike<Readonly<{ data: unknown; error: Readonly<{ code?: string }> | null }>>;
type Rpc = (functionName: string, input: Record<string, unknown>) => RpcResult;
type RegistrationMaterial = ReturnType<typeof createAppAttestRegistrationChallengeMaterialV1>;
type NativeMaterial = ReturnType<typeof createNativeEnrollmentChallengeMaterialV1>;

export type NativeEnrollmentTransactionClientV1 = Readonly<{
  acceptNativeEnrollment: (input: Readonly<{
    appAttestChallengeId: string; claimantUserId: string; evidence: NativeEnrollmentAcceptanceEvidenceV1;
    idempotencyKey: string; nativeChallengeId: string; portalSessionId: string;
  }>) => Promise<NativeAcceptanceResultV1>;
  consumeRegistration: (input: Readonly<{
    challengeBytesDigest: string; challengeId: string; claimantUserId: string;
    idempotencyKey: string; portalSessionId: string; verified: VerifiedAppAttestRegistrationV1;
  }>) => Promise<Readonly<{ appAttestKeyRecordId: string; assertionCounter: number; challengeId: string; replayed: boolean }>>;
  getNativeEvidence: (input: Readonly<{
    appAttestChallengeId: string; claimantUserId: string; nativeChallengeId: string; portalSessionId: string;
  }>) => Promise<StoredNativeEnrollmentEvidenceV1>;
  getRegistrationChallenge: (input: Readonly<{
    challengeId: string; claimantUserId: string; portalSessionId: string;
  }>) => Promise<Readonly<{ challengeBytesBase64Url: string; challengeBytesDigest: string }>>;
  issueNativeChallenge: (input: Readonly<{
    claimantUserId: string; eligibilityVersion: number; idempotencyKey: string; invitationId: string;
    invitationVersion: number; material: NativeMaterial; portalSessionId: string;
    recipientAddressDigest: string;
  }>) => Promise<ChallengeIssueResultV1>;
  issueRegistrationChallenge: (input: Readonly<{
    claimantUserId: string; idempotencyKey: string; material: RegistrationMaterial; portalSessionId: string;
  }>) => Promise<Readonly<{ challengeId: string; expiresAt: string; replayed: boolean }>>;
}>;

export type ChallengeIssueResultV1 = Readonly<{
  appAttestChallengeId: string; expiresAt: string; nativeChallengeId: string; replayed: boolean;
}>;
export type NativeAcceptanceResultV1 = Readonly<{
  assertionCounter: number; caseId: string; caseVersion: number; claimantKeyId: string;
  invitationId: string; invitationVersion: number; replayed: boolean;
}>;

export class NativeEnrollmentTransactionError extends Error {
  readonly code: string | undefined;
  constructor(code: string | undefined) {
    super("Native enrollment transaction failed."); this.name = "NativeEnrollmentTransactionError"; this.code = code;
  }
}

export function createNativeEnrollmentTransactionClientV1(rpc: Rpc): NativeEnrollmentTransactionClientV1 {
  return {
    async acceptNativeEnrollment(input) {
      return readNativeAcceptance(await rpc("claimant_accept_native_enrollment", {
        p_app_attest_challenge_id: input.appAttestChallengeId,
        p_claimant_user_id: input.claimantUserId,
        p_expected_app_attest_counter: input.evidence.expectedAppAttestCounter,
        p_idempotency_key: input.idempotencyKey,
        p_native_challenge_id: input.nativeChallengeId,
        p_portal_session_id: input.portalSessionId,
        p_verified_app_attest_challenge_digest: input.evidence.verifiedAppAttestChallengeDigest,
        p_verified_app_attest_counter: input.evidence.verifiedAppAttestCounter,
        p_verified_bundle_version: input.evidence.verifiedBundleVersion,
        p_verified_native_challenge_digest: input.evidence.verifiedNativeChallengeDigest,
        p_verified_validation_category: input.evidence.verifiedValidationCategory,
      }));
    },
    async consumeRegistration(input) {
      return readRegistrationConsumption(await rpc("claimant_consume_app_attest_registration_challenge", {
        p_attestation_receipt_base64: input.verified.receiptBase64,
        p_challenge_id: input.challengeId,
        p_claimant_user_id: input.claimantUserId,
        p_idempotency_key: input.idempotencyKey,
        p_portal_session_id: input.portalSessionId,
        p_public_key_spki_base64: input.verified.publicKeySpkiBase64,
        p_verified_app_attest_key_id_digest: input.verified.appAttestKeyIdDigest,
        p_verified_bundle_version: input.verified.bundleVersion,
        p_verified_challenge_bytes_digest: input.challengeBytesDigest,
        p_verified_validation_category: input.verified.validationCategory,
      }));
    },
    async getNativeEvidence(input) {
      return readNativeEvidence(await rpc("claimant_get_native_enrollment_evidence", {
        p_app_attest_challenge_id: input.appAttestChallengeId,
        p_claimant_user_id: input.claimantUserId,
        p_native_challenge_id: input.nativeChallengeId,
        p_portal_session_id: input.portalSessionId,
      }));
    },
    async getRegistrationChallenge(input) {
      return readRegistrationChallenge(await rpc("claimant_get_app_attest_registration_challenge", {
        p_challenge_id: input.challengeId, p_claimant_user_id: input.claimantUserId,
        p_portal_session_id: input.portalSessionId,
      }));
    },
    async issueNativeChallenge(input) {
      const native = input.material.nativeChallenge; const app = input.material.appAttestChallenge;
      return readNativeIssue(await rpc("claimant_issue_native_enrollment_challenge", {
        p_app_attest_challenge_bytes_base64url: input.material.appAttestChallengeBytesBase64Url,
        p_app_attest_challenge_bytes_digest: input.material.appAttestChallengeBytesDigest,
        p_app_attest_challenge_id: app.challenge_id,
        p_app_attest_key_id_digest: app.app_attest_key_id_digest,
        p_app_id_hash: app.app_id_hash,
        p_claimant_key_id: input.material.claimantKeyId,
        p_claimant_user_id: input.claimantUserId,
        p_device_binding_digest: native.device_binding_digest,
        p_environment: app.environment,
        p_expected_eligibility_version: input.eligibilityVersion,
        p_expected_invitation_version: input.invitationVersion,
        p_expires_at: native.expires_at,
        p_idempotency_key: input.idempotencyKey,
        p_invitation_id: input.invitationId,
        p_issued_at: native.issued_at,
        p_native_challenge_bytes_base64url: input.material.nativeChallengeBytesBase64Url,
        p_native_challenge_bytes_digest: input.material.nativeChallengeBytesDigest,
        p_native_challenge_id: native.challenge_id,
        p_origin: native.origin,
        p_policy_pack_id: native.policy_pack_id,
        p_policy_pack_version: native.policy_pack_version,
        p_portal_session_id: input.portalSessionId,
        p_public_key_fingerprint: native.public_key_fingerprint,
        p_public_key_jwk: input.material.publicKeyJwk,
        p_public_key_x963_base64url: input.material.claimantPublicKeyBase64Url,
        p_recipient_address_digest: input.recipientAddressDigest,
        p_required_bundle_version: app.required_bundle_version,
        p_required_validation_category: app.required_validation_category,
        p_server_ephemeral_private_key_envelope: input.material.serverEphemeralPrivateKeyEnvelope,
      }));
    },
    async issueRegistrationChallenge(input) {
      const challenge = input.material.challenge;
      return readRegistrationIssue(await rpc("claimant_issue_app_attest_registration_challenge", {
        p_app_attest_key_id_digest: challenge.app_attest_key_id_digest, p_app_id_hash: challenge.app_id_hash,
        p_challenge_bytes_base64url: input.material.challengeBytesBase64Url,
        p_challenge_bytes_digest: input.material.challengeBytesDigest, p_challenge_id: challenge.challenge_id,
        p_claimant_user_id: input.claimantUserId, p_environment: challenge.environment,
        p_expires_at: challenge.expires_at, p_idempotency_key: input.idempotencyKey,
        p_issued_at: challenge.issued_at, p_portal_session_id: input.portalSessionId,
        p_required_bundle_version: challenge.required_bundle_version,
        p_required_validation_category: challenge.required_validation_category,
      }));
    },
  };
}

export function createNativeEnrollmentSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string;
  supabaseUrl: string;
}>): NativeEnrollmentTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return createNativeEnrollmentTransactionClientV1((name, input) => supabase.rpc(name, input));
}

const digest = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const registrationIssueSchema = z.strictObject({ challenge_id: z.string().uuid(), expires_at: z.string(), replayed: z.boolean() });
const nativeIssueSchema = z.strictObject({ app_attest_challenge_id: z.string().uuid(), expires_at: z.string(), native_challenge_id: z.string().uuid(), replayed: z.boolean() });
const registrationChallengeSchema = z.strictObject({ challenge_bytes_base64url: z.string(), challenge_bytes_digest: digest });
const registrationConsumptionSchema = z.strictObject({ app_attest_key_record_id: z.string().uuid(), assertion_counter: z.number().int(), challenge_id: z.string().uuid(), replayed: z.boolean() });
const nativeEvidenceSchema = z.strictObject({
  app_attest_challenge_bytes_base64url: z.string(), app_attest_challenge_bytes_digest: digest,
  app_attest_challenge_id: z.string().uuid(), app_attest_key_id_digest: digest,
  app_attest_public_key_spki_base64: z.string(), claimant_public_key_base64url: z.string(),
  claimant_user_id: z.string().uuid(), native_challenge_bytes_base64url: z.string(),
  native_challenge_bytes_digest: digest, native_challenge_id: z.string().uuid(),
  previous_app_attest_counter: z.number().int().nonnegative(), server_ephemeral_private_key_envelope: z.string(),
});
const nativeAcceptanceSchema = z.strictObject({ assertion_counter: z.number().int(), case_id: z.string().uuid(),
  case_version: z.number().int(), claimant_key_id: z.string().uuid(), invitation_id: z.string().uuid(),
  invitation_version: z.number().int(), replayed: z.boolean() });

function parse<T>(result: Readonly<{ data: unknown; error: Readonly<{ code?: string }> | null }>, schema: z.ZodType<T>): T {
  if (result.error) throw new NativeEnrollmentTransactionError(result.error.code);
  const parsed = schema.safeParse(result.data); if (!parsed.success) throw new Error("Native enrollment transaction returned an invalid result.");
  return parsed.data;
}
function readRegistrationIssue(result: Awaited<RpcResult>) { const value = parse(result, registrationIssueSchema); return { challengeId: value.challenge_id, expiresAt: value.expires_at, replayed: value.replayed }; }
function readNativeIssue(result: Awaited<RpcResult>) { const value = parse(result, nativeIssueSchema); return { appAttestChallengeId: value.app_attest_challenge_id, expiresAt: value.expires_at, nativeChallengeId: value.native_challenge_id, replayed: value.replayed }; }
function readRegistrationChallenge(result: Awaited<RpcResult>) { const value = parse(result, registrationChallengeSchema); return { challengeBytesBase64Url: value.challenge_bytes_base64url, challengeBytesDigest: value.challenge_bytes_digest }; }
function readRegistrationConsumption(result: Awaited<RpcResult>) { const value = parse(result, registrationConsumptionSchema); return { appAttestKeyRecordId: value.app_attest_key_record_id, assertionCounter: value.assertion_counter, challengeId: value.challenge_id, replayed: value.replayed }; }
function readNativeEvidence(result: Awaited<RpcResult>): StoredNativeEnrollmentEvidenceV1 { const value = parse(result, nativeEvidenceSchema); return {
  appAttestChallengeBytesBase64Url: value.app_attest_challenge_bytes_base64url, appAttestChallengeBytesDigest: value.app_attest_challenge_bytes_digest,
  appAttestChallengeId: value.app_attest_challenge_id, appAttestKeyIdDigest: value.app_attest_key_id_digest,
  appAttestPublicKeySpkiBase64: value.app_attest_public_key_spki_base64, claimantPublicKeyBase64Url: value.claimant_public_key_base64url,
  claimantUserId: value.claimant_user_id, nativeChallengeBytesBase64Url: value.native_challenge_bytes_base64url,
  nativeChallengeBytesDigest: value.native_challenge_bytes_digest, nativeChallengeId: value.native_challenge_id,
  previousAppAttestCounter: value.previous_app_attest_counter, serverEphemeralPrivateKeyEnvelope: value.server_ephemeral_private_key_envelope,
}; }
function readNativeAcceptance(result: Awaited<RpcResult>): NativeAcceptanceResultV1 { const value = parse(result, nativeAcceptanceSchema); return {
  assertionCounter: value.assertion_counter, caseId: value.case_id, caseVersion: value.case_version,
  claimantKeyId: value.claimant_key_id, invitationId: value.invitation_id,
  invitationVersion: value.invitation_version, replayed: value.replayed,
}; }
