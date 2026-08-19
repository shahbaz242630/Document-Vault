import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;

export type OfflineCodeV2RegistrationInput = Readonly<{
  locatorRecordId: string; ownerUserId: string; locatorIndexDigest: string;
  locatorCommitment: string; grantId: string; proofPublicKey: string;
  recordBindingDigest: string; wrapNonce: string; wrapCiphertext: string;
  wrapAssociatedDataDigest: string; issuedAt: string; expiresAt: string;
  idempotencyKey: string;
}>;
export type OfflineCodeV2ChallengeInput = Readonly<{
  locatorIndexDigest: string; challengeId: string; locatorCommitment: string;
  recordBindingDigest: string; proofPublicKey: string; challengeBytesBase64url: string;
  challengeBytesDigest: string; origin: string; nonce: string; issuedAt: string;
  expiresAt: string; idempotencyKey: string;
}>;
export type OfflineCodeV2AttemptInput = Readonly<{
  locatorRecordId: string; challengeId: string; verifiedChallengeBytesDigest: string;
  verifiedRecordBindingDigest: string; proofSignatureDigest: string;
  verificationOutcome: "invalid" | "verified"; idempotencyKey: string;
}>;
export type OfflineCodeV2RevocationInput = Readonly<{
  locatorRecordId: string; ownerUserId: string; expectedLocatorVersion: 2;
  reason: "owner_revoked"; idempotencyKey: string;
}>;

export type OfflineCodeV2RegistrationResult = Readonly<{
  locatorRecordId: string; locatorVersion: 2; status: "active";
  authority: "route_possession_only"; syntheticOnly: true; claimCreated: false;
  releaseAuthorized: false; replayed: boolean;
}>;
export type OfflineCodeV2ChallengeResult = Readonly<{
  challengeId: string; locatorRecordId: string; locatorVersion: 2;
  proofKeyVersion: 1; authority: "route_possession_only"; expiresAt: string;
  claimCreated: false; releaseAuthorized: false; replayed: boolean;
}>;
export type OfflineCodeV2AttemptResult = Readonly<{
  challengeId: string; locatorRecordId: string;
  verificationOutcome: "invalid" | "verified"; routePossessionAsserted: boolean;
  locatorLocked: boolean; identityVerified: false; claimCreated: false;
  releaseAuthorized: false; replayed: boolean;
}>;
export type OfflineCodeV2RevocationResult = Readonly<{
  locatorRecordId: string; locatorVersion: 2; status: "revoked";
  futureChallengesAllowed: false; claimCreated: false; releaseAuthorized: false;
  replayed: boolean;
}>;

export type OfflineCodeV2PersistenceTransactionClient = Readonly<{
  register(input: OfflineCodeV2RegistrationInput): Promise<OfflineCodeV2RegistrationResult>;
  issueChallenge(input: OfflineCodeV2ChallengeInput): Promise<OfflineCodeV2ChallengeResult>;
  recordAttempt(input: OfflineCodeV2AttemptInput): Promise<OfflineCodeV2AttemptResult>;
  revoke(input: OfflineCodeV2RevocationInput): Promise<OfflineCodeV2RevocationResult>;
}>;

export class OfflineCodeV2PersistenceTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Offline-code V2 persistence transaction failed.");
    this.name = "OfflineCodeV2PersistenceTransactionError";
  }
}

export function createOfflineCodeV2PersistenceTransactionClient(
  rpc: Rpc,
): OfflineCodeV2PersistenceTransactionClient {
  const invoke = async <T>(name: string, values: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> => {
    const response = await rpc(name, values);
    if (response.error) throw new OfflineCodeV2PersistenceTransactionError(response.error.code);
    const parsed = schema.safeParse(response.data);
    if (!parsed.success) throw new Error("Offline-code V2 persistence returned an invalid result.");
    return parsed.data;
  };
  return {
    async register(value) {
      const result = await invoke("claimant_register_offline_code_v2_locator", {
        p_locator_record_id: value.locatorRecordId, p_owner_user_id: value.ownerUserId,
        p_locator_index_digest: value.locatorIndexDigest,
        p_locator_commitment: value.locatorCommitment, p_grant_id: value.grantId,
        p_proof_public_key: value.proofPublicKey,
        p_record_binding_digest: value.recordBindingDigest, p_wrap_nonce: value.wrapNonce,
        p_wrap_ciphertext: value.wrapCiphertext,
        p_wrap_associated_data_digest: value.wrapAssociatedDataDigest,
        p_issued_at: value.issuedAt, p_expires_at: value.expiresAt,
        p_idempotency_key: value.idempotencyKey,
      }, registrationResultSchema);
      requireEqual(result.locator_record_id, value.locatorRecordId);
      return { locatorRecordId: result.locator_record_id, locatorVersion: result.locator_version,
        status: result.status, authority: result.authority, syntheticOnly: result.synthetic_only,
        claimCreated: result.claim_created, releaseAuthorized: result.release_authorized,
        replayed: result.replayed };
    },
    async issueChallenge(value) {
      const result = await invoke("claimant_issue_offline_code_v2_challenge", {
        p_locator_index_digest: value.locatorIndexDigest, p_challenge_id: value.challengeId,
        p_locator_commitment: value.locatorCommitment,
        p_record_binding_digest: value.recordBindingDigest,
        p_proof_public_key: value.proofPublicKey,
        p_challenge_bytes_base64url: value.challengeBytesBase64url,
        p_challenge_bytes_digest: value.challengeBytesDigest, p_origin: value.origin,
        p_nonce: value.nonce, p_issued_at: value.issuedAt, p_expires_at: value.expiresAt,
        p_idempotency_key: value.idempotencyKey,
      }, challengeResultSchema);
      requireEqual(result.challenge_id, value.challengeId);
      requireEqual(result.expires_at, value.expiresAt);
      return { challengeId: result.challenge_id, locatorRecordId: result.locator_record_id,
        locatorVersion: result.locator_version, proofKeyVersion: result.proof_key_version,
        authority: result.authority, expiresAt: result.expires_at,
        claimCreated: result.claim_created, releaseAuthorized: result.release_authorized,
        replayed: result.replayed };
    },
    async recordAttempt(value) {
      const result = await invoke("claimant_record_offline_code_v2_attempt", {
        p_locator_record_id: value.locatorRecordId, p_challenge_id: value.challengeId,
        p_verified_challenge_bytes_digest: value.verifiedChallengeBytesDigest,
        p_verified_record_binding_digest: value.verifiedRecordBindingDigest,
        p_proof_signature_digest: value.proofSignatureDigest,
        p_verification_outcome: value.verificationOutcome,
        p_idempotency_key: value.idempotencyKey,
      }, attemptResultSchema);
      requireEqual(result.locator_record_id, value.locatorRecordId);
      requireEqual(result.challenge_id, value.challengeId);
      requireEqual(result.verification_outcome, value.verificationOutcome);
      if (result.route_possession_asserted !== (value.verificationOutcome === "verified")) {
        throw new Error("Offline-code V2 persistence returned an incoherent result.");
      }
      return { challengeId: result.challenge_id, locatorRecordId: result.locator_record_id,
        verificationOutcome: result.verification_outcome,
        routePossessionAsserted: result.route_possession_asserted,
        locatorLocked: result.locator_locked, identityVerified: result.identity_verified,
        claimCreated: result.claim_created, releaseAuthorized: result.release_authorized,
        replayed: result.replayed };
    },
    async revoke(value) {
      const result = await invoke("claimant_revoke_offline_code_v2_locator", {
        p_locator_record_id: value.locatorRecordId, p_owner_user_id: value.ownerUserId,
        p_expected_locator_version: value.expectedLocatorVersion, p_reason: value.reason,
        p_idempotency_key: value.idempotencyKey,
      }, revocationResultSchema);
      requireEqual(result.locator_record_id, value.locatorRecordId);
      return { locatorRecordId: result.locator_record_id, locatorVersion: result.locator_version,
        status: result.status, futureChallengesAllowed: result.future_challenges_allowed,
        claimCreated: result.claim_created, releaseAuthorized: result.release_authorized,
        replayed: result.replayed };
    },
  };
}

const uuid = z.string().uuid();
const safeBase = { claim_created: z.literal(false), release_authorized: z.literal(false),
  replayed: z.boolean() } as const;
const registrationResultSchema = z.strictObject({ ...safeBase, locator_record_id: uuid,
  locator_version: z.literal(2), status: z.literal("active"),
  authority: z.literal("route_possession_only"), synthetic_only: z.literal(true) });
const challengeResultSchema = z.strictObject({ ...safeBase, challenge_id: uuid,
  locator_record_id: uuid, locator_version: z.literal(2), proof_key_version: z.literal(1),
  authority: z.literal("route_possession_only"), expires_at: z.string().datetime({ offset: true }) });
const attemptResultSchema = z.strictObject({ ...safeBase, challenge_id: uuid,
  locator_record_id: uuid, verification_outcome: z.enum(["invalid", "verified"]),
  route_possession_asserted: z.boolean(), locator_locked: z.boolean(),
  identity_verified: z.literal(false) });
const revocationResultSchema = z.strictObject({ ...safeBase, locator_record_id: uuid,
  locator_version: z.literal(2), status: z.literal("revoked"),
  future_challenges_allowed: z.literal(false) });

function requireEqual(left: string, right: string): void {
  if (left !== right) throw new Error("Offline-code V2 persistence returned an invalid binding.");
}
