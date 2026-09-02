import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown;
  error: Readonly<{ code?: string }> | null;
}>>;

export type OfflineCodeV2CaseBindingInput = Readonly<{
  caseId: string;
  claimantUserId: string;
  portalSessionId: string;
  challengeId: string;
  expectedRecordBindingDigest: string;
  policyPackId: "synthetic_policy_death_alpha";
  policyPackVersion: 1;
  idempotencyKey: string;
}>;

export type OfflineCodeV2CaseBindingResult = Readonly<{
  caseId: string;
  caseVersion: 1;
  state: "draft";
  routeProfile: "offline_code_v2";
  authority: "route_possession_only";
  claimantSessionBound: true;
  caseCreated: true;
  identityVerified: false;
  relationshipVerified: false;
  intakeStarted: false;
  reviewStarted: false;
  releaseAuthorized: false;
  replayed: boolean;
}>;

export class OfflineCodeV2CaseBindingTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Offline-code V2 case binding transaction failed.");
    this.name = "OfflineCodeV2CaseBindingTransactionError";
  }
}

export function createOfflineCodeV2CaseBindingTransactionClient(rpc: Rpc) {
  return {
    async bind(input: OfflineCodeV2CaseBindingInput): Promise<OfflineCodeV2CaseBindingResult> {
      const response = await rpc("claimant_bind_offline_code_v2_case", {
        p_case_id: input.caseId,
        p_claimant_user_id: input.claimantUserId,
        p_portal_session_id: input.portalSessionId,
        p_challenge_id: input.challengeId,
        p_expected_record_binding_digest: input.expectedRecordBindingDigest,
        p_policy_pack_id: input.policyPackId,
        p_policy_pack_version: input.policyPackVersion,
        p_idempotency_key: input.idempotencyKey,
      });
      if (response.error) throw new OfflineCodeV2CaseBindingTransactionError(response.error.code);
      const parsed = resultSchema.safeParse(response.data);
      if (!parsed.success || parsed.data.case_id !== input.caseId) {
        throw new Error("Offline-code V2 case binding returned an invalid result.");
      }
      return {
        caseId: parsed.data.case_id,
        caseVersion: parsed.data.case_version,
        state: parsed.data.state,
        routeProfile: parsed.data.route_profile,
        authority: parsed.data.authority,
        claimantSessionBound: parsed.data.claimant_session_bound,
        caseCreated: parsed.data.case_created,
        identityVerified: parsed.data.identity_verified,
        relationshipVerified: parsed.data.relationship_verified,
        intakeStarted: parsed.data.intake_started,
        reviewStarted: parsed.data.review_started,
        releaseAuthorized: parsed.data.release_authorized,
        replayed: parsed.data.replayed,
      };
    },
  };
}

const resultSchema = z.strictObject({
  case_id: z.string().uuid(),
  case_version: z.literal(1),
  state: z.literal("draft"),
  route_profile: z.literal("offline_code_v2"),
  authority: z.literal("route_possession_only"),
  claimant_session_bound: z.literal(true),
  case_created: z.literal(true),
  identity_verified: z.literal(false),
  relationship_verified: z.literal(false),
  intake_started: z.literal(false),
  review_started: z.literal(false),
  release_authorized: z.literal(false),
  replayed: z.boolean(),
});
