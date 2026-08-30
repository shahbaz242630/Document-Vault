import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";

import {
  assertOfflineCodeChallengeV2,
  assertOfflineCodePossessionProofV2,
  canonicalJson,
  type OfflineCodeChallengeV2,
  type OfflineCodePossessionProofV2,
} from "@vault/shared-types";
import { z } from "zod";

import type { OfflineCodeV2PersistenceTransactionClient }
  from "./offline-code-v2-persistence-transaction-client.js";

export const CLAIMANT_OFFLINE_CODE_V2_PROOF_ATTEMPT_COORDINATOR_APPROVED = false as const;

export class OfflineCodeV2ProofAttemptCoordinatorError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input" | "boundary_failure") {
    super("Offline-code V2 proof is unavailable.");
    this.name = "OfflineCodeV2ProofAttemptCoordinatorError";
  }
}

type Dependencies = Readonly<{
  approved?: boolean;
  persistence: Pick<OfflineCodeV2PersistenceTransactionClient, "recordAttempt">;
}>;

const uuid = z.string().uuid();
const requestSchema = z.strictObject({
  challenge: z.unknown(),
  challengeBytesBase64url: z.string().regex(/^[A-Za-z0-9_-]{64,8192}$/u),
  possessionProof: z.unknown(),
  idempotencyKey: uuid,
});
const proofLabel = "sanduqkin:claim:offline-code:v2:possession-proof";
const ed25519SpkiPrefix = Buffer.from("302a300506032b6570032100", "hex");

export function createOfflineCodeV2ProofAttemptCoordinator(deps: Dependencies) {
  return {
    async verify(value: unknown) {
      if (!(deps.approved ?? CLAIMANT_OFFLINE_CODE_V2_PROOF_ATTEMPT_COORDINATOR_APPROVED)) {
        throw new OfflineCodeV2ProofAttemptCoordinatorError("disabled");
      }
      const request = parse(requestSchema, value);
      const challenge = parseChallenge(request.challenge);
      const proof = parseProof(request.possessionProof);
      const challengeBytes = Buffer.from(canonicalJson(challenge as never));
      const suppliedChallengeBytes = decodeCanonicalBase64url(request.challengeBytesBase64url);
      if (!equalBytes(challengeBytes, suppliedChallengeBytes)) {
        throw new OfflineCodeV2ProofAttemptCoordinatorError("invalid_input");
      }

      const bindingsMatch = proofMatchesChallenge(proof, challenge);
      const signatureValid = bindingsMatch && verifyProof(proof, challenge);
      const verificationOutcome = signatureValid ? "verified" as const : "invalid" as const;
      const attempt = {
        locatorRecordId: challenge.locator_record_id,
        challengeId: challenge.challenge_id,
        verifiedChallengeBytesDigest: digest(challengeBytes),
        verifiedRecordBindingDigest: challenge.record_binding_digest,
        proofSignatureDigest: digest(Buffer.from(proof.signature, "base64url")),
        verificationOutcome,
        idempotencyKey: request.idempotencyKey,
      };

      try {
        const result = await deps.persistence.recordAttempt(attempt);
        if (!signatureValid) return rejected();
        if (!result.routePossessionAsserted || result.verificationOutcome !== "verified"
          || result.challengeId !== challenge.challenge_id
          || result.locatorRecordId !== challenge.locator_record_id
          || result.identityVerified !== false || result.claimCreated !== false
          || result.releaseAuthorized !== false) {
          throw new OfflineCodeV2ProofAttemptCoordinatorError("boundary_failure");
        }
        return {
          status: "proof_verified" as const,
          authority: "route_possession_only" as const,
          routePossessionAsserted: true as const,
          identityVerified: result.identityVerified,
          claimCreated: result.claimCreated,
          releaseAuthorized: result.releaseAuthorized,
        };
      } catch (error) {
        if (!signatureValid) return rejected();
        if (error instanceof OfflineCodeV2ProofAttemptCoordinatorError) throw error;
        throw new OfflineCodeV2ProofAttemptCoordinatorError("boundary_failure");
      }
    },
  };
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new OfflineCodeV2ProofAttemptCoordinatorError("invalid_input");
  return parsed.data;
}

function parseChallenge(value: unknown): OfflineCodeChallengeV2 {
  try {
    assertOfflineCodeChallengeV2(value);
    if (value.locator_version !== 2 || value.proof_key_version !== 1) throw new Error();
    return value;
  } catch {
    throw new OfflineCodeV2ProofAttemptCoordinatorError("invalid_input");
  }
}

function parseProof(value: unknown): OfflineCodePossessionProofV2 {
  try {
    const proof = assertOfflineCodePossessionProofV2(value);
    if (proof.locator_version !== 2 || proof.proof_key_version !== 1) throw new Error();
    return proof;
  } catch {
    throw new OfflineCodeV2ProofAttemptCoordinatorError("invalid_input");
  }
}

function proofMatchesChallenge(proof: OfflineCodePossessionProofV2,
  challenge: OfflineCodeChallengeV2): boolean {
  return proof.challenge_id === challenge.challenge_id
    && proof.locator_record_id === challenge.locator_record_id
    && proof.locator_version === challenge.locator_version
    && proof.proof_key_version === challenge.proof_key_version
    && proof.proof_public_key === challenge.proof_public_key
    && proof.record_binding_digest === challenge.record_binding_digest;
}

function verifyProof(proof: OfflineCodePossessionProofV2,
  challenge: OfflineCodeChallengeV2): boolean {
  try {
    const publicKeyBytes = Buffer.from(challenge.proof_public_key, "base64url");
    const publicKey = createPublicKey({
      key: Buffer.concat([ed25519SpkiPrefix, publicKeyBytes]),
      format: "der",
      type: "spki",
    });
    const message = Buffer.from(canonicalJson({
      protocol: "sanduqkin:claim:offline-code:v2",
      purpose: "possession_proof",
      label: proofLabel,
      challenge,
    }));
    return verify(null, message, publicKey, Buffer.from(proof.signature, "base64url"));
  } catch {
    return false;
  }
}

function decodeCanonicalBase64url(value: string): Buffer {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value) {
    throw new OfflineCodeV2ProofAttemptCoordinatorError("invalid_input");
  }
  return bytes;
}

function equalBytes(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function digest(value: Buffer): string {
  return createHash("sha256").update(value).digest("base64url");
}

function rejected() {
  return {
    status: "proof_rejected" as const,
    routePossessionAsserted: false as const,
    identityVerified: false as const,
    claimCreated: false as const,
    releaseAuthorized: false as const,
  };
}
