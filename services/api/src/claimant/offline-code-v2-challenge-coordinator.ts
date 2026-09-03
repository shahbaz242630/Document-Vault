import { normalizeOfflineCodePublicLocatorV2 } from "@vault/shared-types";
import { z } from "zod";

import type { OfflineCodeV2PersistenceTransactionClient }
  from "./offline-code-v2-persistence-transaction-client.js";

export const CLAIMANT_OFFLINE_CODE_V2_CHALLENGE_COORDINATOR_APPROVED = false as const;

export class OfflineCodeV2ChallengeCoordinatorError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input" | "boundary_failure") {
    super("Offline-code V2 challenge is unavailable.");
    this.name = "OfflineCodeV2ChallengeCoordinatorError";
  }
}

export type OfflineCodeV2BoundaryDigests = Readonly<{
  locatorIndexDigest: string; networkBucketDigest: string;
  deviceBucketDigest?: string; globalBucketDigest: string;
}>;
export type OfflineCodeV2BoundaryIndexer = Readonly<{
  derive(input: Readonly<{ normalizedLocator: string; networkSignal: string;
    deviceSignal?: string }>): Promise<OfflineCodeV2BoundaryDigests>;
}>;

type Dependencies = Readonly<{ approved?: boolean; origin: string;
  indexer: OfflineCodeV2BoundaryIndexer;
  persistence: Pick<OfflineCodeV2PersistenceTransactionClient, "issueChallenge"> }>;

const uuid = z.string().uuid();
const requestSchema = z.strictObject({ locator: z.unknown(), networkSignal: z.string().min(1).max(512),
  deviceSignal: z.string().min(1).max(512).optional(), idempotencyKey: uuid });
const base64url32 = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u);
const digestsSchema = z.strictObject({ locatorIndexDigest: base64url32,
  networkBucketDigest: base64url32, deviceBucketDigest: base64url32.optional(),
  globalBucketDigest: base64url32 });
const originSchema = z.string().url().startsWith("https://").max(300);

export function createOfflineCodeV2ChallengeCoordinator(deps: Dependencies) {
  return { async issue(value: unknown) {
    if (!(deps.approved ?? CLAIMANT_OFFLINE_CODE_V2_CHALLENGE_COORDINATOR_APPROVED)) {
      throw new OfflineCodeV2ChallengeCoordinatorError("disabled");
    }
    const request = parse(requestSchema, value);
    const origin = parse(originSchema, deps.origin);
    let normalizedLocator: string;
    try { normalizedLocator = normalizeOfflineCodePublicLocatorV2(request.locator); }
    catch { throw new OfflineCodeV2ChallengeCoordinatorError("invalid_input"); }
    let derived: OfflineCodeV2BoundaryDigests;
    try { derived = await deps.indexer.derive({ normalizedLocator,
      networkSignal: request.networkSignal, deviceSignal: request.deviceSignal }); }
    catch { throw new OfflineCodeV2ChallengeCoordinatorError("boundary_failure"); }
    const parsedDigests = digestsSchema.safeParse(derived);
    if (!parsedDigests.success) throw new OfflineCodeV2ChallengeCoordinatorError("boundary_failure");
    const digests = parsedDigests.data;
    try {
      const result = await deps.persistence.issueChallenge({ ...digests, origin,
        idempotencyKey: request.idempotencyKey });
      if (result.rateLimited) return { status: "rate_limited" as const,
        retryAfterSeconds: result.retryAfterSeconds, identityVerified: result.identityVerified,
        claimCreated: result.claimCreated, releaseAuthorized: result.releaseAuthorized };
      return { status: "challenge_issued" as const, authority: "route_possession_only" as const,
        challenge: result.challenge, challengeBytesBase64url: result.challengeBytesBase64url,
        kdfProfile: result.kdfProfile, identityVerified: result.identityVerified,
        claimCreated: result.claimCreated, releaseAuthorized: result.releaseAuthorized };
    } catch { throw new OfflineCodeV2ChallengeCoordinatorError("boundary_failure"); }
  } };
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new OfflineCodeV2ChallengeCoordinatorError("invalid_input");
  return parsed.data;
}
