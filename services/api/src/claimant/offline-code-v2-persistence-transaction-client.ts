import { createHash } from "node:crypto";

import { canonicalJson } from "@vault/shared-types";
import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;

export type OfflineCodeV2RegistrationInput = Readonly<{
  locatorRecordId: string; ownerUserId: string; locatorIndexDigest: string;
  locatorCommitment: string; grantId: string; proofPublicKey: string;
  recordBindingDigest: string; kdfSalt: string; wrapNonce: string; wrapCiphertext: string;
  wrapAssociatedDataDigest: string; issuedAt: string; expiresAt: string;
  idempotencyKey: string;
}>;
export type OfflineCodeV2ChallengeInput = Readonly<{
  locatorIndexDigest: string; networkBucketDigest: string; deviceBucketDigest?: string;
  globalBucketDigest: string; origin: string; idempotencyKey: string;
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
  rateLimited: true; retryAfterSeconds: 300; identityVerified: false;
  claimCreated: false; releaseAuthorized: false; replayed: false;
}> | Readonly<{ rateLimited: false; challenge: OfflineCodeV2PublicChallenge;
  challengeBytesBase64url: string; challengeBytesDigest: string;
  kdfProfile: OfflineCodeV2PublicKdfProfile; identityVerified: false;
  claimCreated: false; releaseAuthorized: false; replayed: boolean }>;
export type OfflineCodeV2PublicChallenge = Readonly<{
  authority: "route_possession_only"; challenge_id: string; expires_at: string;
  issued_at: string; locator_commitment: string; locator_record_id: string;
  locator_version: 2; nonce: string; origin: string; proof_key_version: 1;
  proof_public_key: string; protocol: "sanduqkin:claim:offline-code:v2";
  purpose: "possession_challenge"; record_binding_digest: string;
}>;
export type OfflineCodeV2PublicKdfProfile = Readonly<{
  algorithm: "argon2id"; memlimit_bytes: 67_108_864; opslimit: 2; output_bytes: 32;
  production_approved: false; profile_id: "argon2id-synthetic-test-v2";
  protocol: "sanduqkin:claim:offline-code:v2"; purpose: "client_secret_root";
  salt: string;
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
        p_kdf_salt: value.kdfSalt,
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
        p_locator_index_digest: value.locatorIndexDigest,
        p_network_bucket_digest: value.networkBucketDigest,
        p_device_bucket_digest: value.deviceBucketDigest ?? null,
        p_global_bucket_digest: value.globalBucketDigest, p_origin: value.origin,
        p_idempotency_key: value.idempotencyKey,
      }, challengeResultSchema);
      if (result.rate_limited) return { rateLimited: true,
        retryAfterSeconds: result.retry_after_seconds,
        identityVerified: result.identity_verified, claimCreated: result.claim_created,
        releaseAuthorized: result.release_authorized, replayed: result.replayed };
      requireEqual(result.challenge.origin, value.origin);
      requireCanonicalChallenge(result.challenge, result.challenge_bytes_base64url,
        result.challenge_bytes_digest);
      return { rateLimited: false, challenge: result.challenge,
        challengeBytesBase64url: result.challenge_bytes_base64url,
        challengeBytesDigest: result.challenge_bytes_digest,
        kdfProfile: result.kdf_profile, identityVerified: result.identity_verified,
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
const base64url16 = z.string().regex(/^[A-Za-z0-9_-]{21}[AQgw]$/u);
const base64url32 = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u);
const safeBase = { claim_created: z.literal(false), release_authorized: z.literal(false),
  replayed: z.boolean() } as const;
const registrationResultSchema = z.strictObject({ ...safeBase, locator_record_id: uuid,
  locator_version: z.literal(2), status: z.literal("active"),
  authority: z.literal("route_possession_only"), synthetic_only: z.literal(true) });
const challengeSchema = z.strictObject({ authority: z.literal("route_possession_only"),
  challenge_id: uuid, expires_at: z.string().datetime({ offset: true }),
  issued_at: z.string().datetime({ offset: true }), locator_commitment: base64url32,
  locator_record_id: uuid, locator_version: z.literal(2), nonce: base64url32,
  origin: z.string().url().startsWith("https://").max(300), proof_key_version: z.literal(1),
  proof_public_key: base64url32, protocol: z.literal("sanduqkin:claim:offline-code:v2"),
  purpose: z.literal("possession_challenge"), record_binding_digest: base64url32 });
const kdfProfileSchema = z.strictObject({ algorithm: z.literal("argon2id"),
  memlimit_bytes: z.literal(67_108_864), opslimit: z.literal(2), output_bytes: z.literal(32),
  production_approved: z.literal(false), profile_id: z.literal("argon2id-synthetic-test-v2"),
  protocol: z.literal("sanduqkin:claim:offline-code:v2"),
  purpose: z.literal("client_secret_root"), salt: base64url16 });
const challengeResultSchema = z.discriminatedUnion("rate_limited", [
  z.strictObject({ ...safeBase, rate_limited: z.literal(false), challenge: challengeSchema,
    challenge_bytes_base64url: z.string().regex(/^[A-Za-z0-9_-]{64,8192}$/u),
    challenge_bytes_digest: base64url32, kdf_profile: kdfProfileSchema,
    identity_verified: z.literal(false) }),
  z.strictObject({ claim_created: z.literal(false), identity_verified: z.literal(false),
    rate_limited: z.literal(true), release_authorized: z.literal(false),
    replayed: z.literal(false), retry_after_seconds: z.literal(300) }),
]);
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
function requireCanonicalChallenge(challenge: OfflineCodeV2PublicChallenge,
  bytesBase64url: string, digest: string): void {
  const canonical = Buffer.from(canonicalJson(challenge as never));
  if (canonical.toString("base64url") !== bytesBase64url
    || createHash("sha256").update(canonical).digest("base64url") !== digest) {
    throw new Error("Offline-code V2 persistence returned invalid canonical challenge bytes.");
  }
}
