import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;

export type ReviewInterventionInputV1 = Readonly<{
  authorityIdentityId: string; caseId: string; cycleId: string;
  expectedCaseVersion: number; expectedRoundVersion: number; idempotencyKey: string;
  interventionType: "appeal" | "escalation"; reasonClass: "conflict_or_dispute" |
    "independence_concern" | "new_material_information" | "policy_review_required" |
    "procedural_error"; reviewRoundId: string;
}>;
export type ReviewInterventionResultV1 = Readonly<{
  caseId: string; caseVersion: number; cycleId: string; interventionId: string;
  interventionStatus: "open"; interventionType: "appeal" | "escalation";
  releaseAuthorized: false; replayed: boolean; reviewRoundId: string;
  reviewStatus: "held"; roundVersion: number; twoPersonApprovalSatisfied: false;
}>;
export type ReviewInterventionTransactionClientV1 = Readonly<{
  open(input: ReviewInterventionInputV1): Promise<ReviewInterventionResultV1>;
}>;

export class ReviewInterventionTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Review intervention transaction failed.");
    this.name = "ReviewInterventionTransactionError";
  }
}

export function createReviewInterventionTransactionClientV1(rpc: Rpc):
ReviewInterventionTransactionClientV1 {
  return { async open(value) {
    const response = await rpc("claimant_open_review_intervention", {
      p_authority_identity_id: value.authorityIdentityId, p_case_id: value.caseId,
      p_cycle_id: value.cycleId, p_expected_case_version: value.expectedCaseVersion,
      p_expected_round_version: value.expectedRoundVersion,
      p_idempotency_key: value.idempotencyKey,
      p_intervention_type: value.interventionType, p_reason_class: value.reasonClass,
      p_review_round_id: value.reviewRoundId });
    if (response.error) throw new ReviewInterventionTransactionError(response.error.code);
    const parsed = resultSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.case_id !== value.caseId
      || parsed.data.case_version !== value.expectedCaseVersion
      || parsed.data.cycle_id !== value.cycleId
      || parsed.data.review_round_id !== value.reviewRoundId
      || parsed.data.intervention_type !== value.interventionType
      || parsed.data.round_version !== value.expectedRoundVersion + 1) {
      throw new Error("Review intervention transaction returned an invalid result.");
    }
    return { caseId: parsed.data.case_id, caseVersion: parsed.data.case_version,
      cycleId: parsed.data.cycle_id, interventionId: parsed.data.intervention_id,
      interventionStatus: parsed.data.intervention_status,
      interventionType: parsed.data.intervention_type,
      releaseAuthorized: parsed.data.release_authorized, replayed: parsed.data.replayed,
      reviewRoundId: parsed.data.review_round_id, reviewStatus: parsed.data.review_status,
      roundVersion: parsed.data.round_version,
      twoPersonApprovalSatisfied: parsed.data.two_person_approval_satisfied };
  } };
}

export function createReviewInterventionSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): ReviewInterventionTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return createReviewInterventionTransactionClientV1((name, values) => supabase.rpc(name, values));
}

const resultSchema = z.strictObject({ case_id: z.string().uuid(),
  case_version: z.number().int().min(2), cycle_id: z.string().uuid(),
  intervention_id: z.string().uuid(), intervention_status: z.literal("open"),
  intervention_type: z.enum(["appeal", "escalation"]), release_authorized: z.literal(false),
  replayed: z.boolean(), review_round_id: z.string().uuid(), review_status: z.literal("held"),
  round_version: z.number().int().min(2), two_person_approval_satisfied: z.literal(false) });
