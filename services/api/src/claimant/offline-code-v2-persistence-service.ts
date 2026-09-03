import { z } from "zod";

import type { OfflineCodeV2PersistenceTransactionClient }
  from "./offline-code-v2-persistence-transaction-client.js";

export const CLAIMANT_OFFLINE_CODE_V2_PERSISTENCE_APPROVED = false as const;

export class OfflineCodeV2PersistenceServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input") {
    super("Offline-code V2 persistence is unavailable.");
    this.name = "OfflineCodeV2PersistenceServiceError";
  }
}

export function createOfflineCodeV2PersistenceService(input: Readonly<{
  approved?: boolean;
  transactions: OfflineCodeV2PersistenceTransactionClient;
}>) {
  const enabled = () => input.approved ?? CLAIMANT_OFFLINE_CODE_V2_PERSISTENCE_APPROVED;
  return {
    async register(value: unknown) {
      if (!enabled()) throw new OfflineCodeV2PersistenceServiceError("disabled");
      return input.transactions.register(parse(registrationSchema, value));
    },
    async issueChallenge(value: unknown) {
      if (!enabled()) throw new OfflineCodeV2PersistenceServiceError("disabled");
      return input.transactions.issueChallenge(parse(challengeSchema, value));
    },
    async recordAttempt(value: unknown) {
      if (!enabled()) throw new OfflineCodeV2PersistenceServiceError("disabled");
      return input.transactions.recordAttempt(parse(attemptSchema, value));
    },
    async revoke(value: unknown) {
      if (!enabled()) throw new OfflineCodeV2PersistenceServiceError("disabled");
      return input.transactions.revoke(parse(revocationSchema, value));
    },
  };
}

const uuid = z.string().uuid();
const base64url32 = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u);
const registrationSchema = z.strictObject({ locatorRecordId: uuid, ownerUserId: uuid,
  locatorIndexDigest: base64url32, locatorCommitment: base64url32, grantId: uuid,
  proofPublicKey: base64url32, recordBindingDigest: base64url32,
  kdfSalt: z.string().regex(/^[A-Za-z0-9_-]{21}[AQgw]$/u),
  wrapNonce: z.string().regex(/^[A-Za-z0-9_-]{32}$/u),
  wrapCiphertext: z.string().regex(/^[A-Za-z0-9_-]{64}$/u),
  wrapAssociatedDataDigest: base64url32, issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }), idempotencyKey: uuid });
const challengeSchema = z.strictObject({ locatorIndexDigest: base64url32,
  networkBucketDigest: base64url32, deviceBucketDigest: base64url32.optional(),
  globalBucketDigest: base64url32,
  origin: z.string().url().startsWith("https://").max(300), idempotencyKey: uuid });
const attemptSchema = z.strictObject({ locatorRecordId: uuid, challengeId: uuid,
  verifiedChallengeBytesDigest: base64url32, verifiedRecordBindingDigest: base64url32,
  proofSignatureDigest: base64url32, verificationOutcome: z.enum(["invalid", "verified"]),
  idempotencyKey: uuid });
const revocationSchema = z.strictObject({ locatorRecordId: uuid, ownerUserId: uuid,
  expectedLocatorVersion: z.literal(2), reason: z.literal("owner_revoked"),
  idempotencyKey: uuid });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new OfflineCodeV2PersistenceServiceError("invalid_input");
  return parsed.data;
}
