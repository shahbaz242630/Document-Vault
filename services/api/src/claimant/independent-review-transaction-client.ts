import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;

export type IndependentReviewInputV1 = Readonly<{
  assignmentId: string; caseId: string; checklistDigest: string; cycleId: string;
  decision: "allow" | "hold" | "reject"; evidenceManifestDigest: string;
  expectedAssignmentVersion: number; expectedCaseVersion: number;
  expectedIntakeVersion: number; expectedPreparationVersion: number;
  expectedSubmissionCaseVersion: number; idempotencyKey: string;
  policyPackId: string; policyPackVersion: number; reasonClass:
    "authority_not_established" | "conflict_or_dispute" | "evidence_inconsistent" |
    "identity_not_established" | "more_information_needed" | "policy_review_required" |
    "relationship_not_established" | "requirements_satisfied";
  reviewerIdentityId: string;
}>;
export type IndependentReviewResultV1 = Readonly<{
  caseId: string; caseVersion: number; cycleId: string; releaseAuthorized: false;
  replayed: boolean; reviewComplete: boolean; reviewRoundId: string;
  reviewStatus: "held" | "pending" | "rejected" | "two_person_approved";
  roundVersion: number; twoPersonApprovalSatisfied: boolean;
}>;
export type IndependentReviewTransactionClientV1 = Readonly<{
  record(input: IndependentReviewInputV1): Promise<IndependentReviewResultV1>;
}>;

export class IndependentReviewTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Independent review transaction failed."); this.name = "IndependentReviewTransactionError";
  }
}

export function createIndependentReviewTransactionClientV1(rpc: Rpc):
IndependentReviewTransactionClientV1 {
  return { async record(value) {
    const response = await rpc("claimant_record_independent_review", {
      p_assignment_id: value.assignmentId, p_case_id: value.caseId,
      p_checklist_digest: value.checklistDigest, p_cycle_id: value.cycleId,
      p_decision: value.decision, p_evidence_manifest_digest: value.evidenceManifestDigest,
      p_expected_assignment_version: value.expectedAssignmentVersion,
      p_expected_case_version: value.expectedCaseVersion,
      p_expected_intake_version: value.expectedIntakeVersion,
      p_expected_preparation_version: value.expectedPreparationVersion,
      p_expected_submission_case_version: value.expectedSubmissionCaseVersion,
      p_idempotency_key: value.idempotencyKey, p_policy_pack_id: value.policyPackId,
      p_policy_pack_version: value.policyPackVersion, p_reason_class: value.reasonClass,
      p_reviewer_identity_id: value.reviewerIdentityId });
    if (response.error) throw new IndependentReviewTransactionError(response.error.code);
    const parsed = resultSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.case_id !== value.caseId
      || parsed.data.case_version !== value.expectedCaseVersion
      || parsed.data.cycle_id !== value.cycleId || !coherent(parsed.data)) {
      throw new Error("Independent review transaction returned an invalid result.");
    }
    return { caseId: parsed.data.case_id, caseVersion: parsed.data.case_version,
      cycleId: parsed.data.cycle_id, releaseAuthorized: parsed.data.release_authorized,
      replayed: parsed.data.replayed, reviewComplete: parsed.data.review_complete,
      reviewRoundId: parsed.data.review_round_id, reviewStatus: parsed.data.review_status,
      roundVersion: parsed.data.round_version,
      twoPersonApprovalSatisfied: parsed.data.two_person_approval_satisfied };
  } };
}

export function createIndependentReviewSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): IndependentReviewTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return createIndependentReviewTransactionClientV1((name, values) => supabase.rpc(name, values));
}

const resultSchema = z.strictObject({ case_id: z.string().uuid(),
  case_version: z.number().int().min(2), cycle_id: z.string().uuid(),
  release_authorized: z.literal(false), replayed: z.boolean(), review_complete: z.boolean(),
  review_round_id: z.string().uuid(), review_status: z.enum([
    "held", "pending", "rejected", "two_person_approved"]),
  round_version: z.number().int().positive(), two_person_approval_satisfied: z.boolean() });
function coherent(value: z.infer<typeof resultSchema>) {
  return value.review_status === "pending"
    ? !value.review_complete && !value.two_person_approval_satisfied && value.round_version === 1
    : value.review_complete && value.round_version === 2
      && value.two_person_approval_satisfied === (value.review_status === "two_person_approved");
}
