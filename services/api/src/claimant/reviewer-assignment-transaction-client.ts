import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type RpcResult = PromiseLike<Readonly<{ data: unknown; error: Readonly<{ code?: string }> | null }>>;
type Rpc = (functionName: string, input: Record<string, unknown>) => RpcResult;

export type ReviewerAssignmentReasonV1 = "availability" | "case_involvement" |
  "claimant_relationship" | "independence_concern" | "other_conflict" |
  "owner_relationship";

export type ReviewerAssignmentResultV1 = Readonly<{
  approvalCounted: false;
  assignmentId: string;
  assignmentSlot: 1 | 2;
  assignmentVersion: number;
  caseId: string;
  caseVersion: number;
  cycleId: string;
  reasonClass: ReviewerAssignmentReasonV1 | null;
  releaseAuthorized: false;
  replayed: boolean;
  reviewerDecisionRecorded: false;
  reviewerIdentityId: string;
  status: "assigned" | "conflicted" | "recused";
}>;

export type ReviewerAssignmentTransactionClientV1 = Readonly<{
  assign(input: Readonly<{ assignmentSlot: 1 | 2; caseId: string; cycleId: string;
    expectedCaseVersion: number; idempotencyKey: string;
    reviewerIdentityId: string }>): Promise<ReviewerAssignmentResultV1>;
  declareConflict(input: ReviewerAssignmentTerminalInputV1): Promise<ReviewerAssignmentResultV1>;
  recuse(input: ReviewerAssignmentTerminalInputV1): Promise<ReviewerAssignmentResultV1>;
}>;

export type ReviewerAssignmentTerminalInputV1 = Readonly<{
  assignmentId: string;
  caseId: string;
  expectedAssignmentVersion: number;
  expectedCaseVersion: number;
  idempotencyKey: string;
  reasonClass: ReviewerAssignmentReasonV1;
  reviewerIdentityId: string;
}>;

export class ReviewerAssignmentTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Reviewer assignment transaction failed.");
    this.name = "ReviewerAssignmentTransactionError";
  }
}

export function createReviewerAssignmentTransactionClientV1(
  rpc: Rpc,
): ReviewerAssignmentTransactionClientV1 {
  const call = async (name: string, values: Record<string, unknown>, expected: Readonly<{
    assignmentId?: string;
    assignmentSlot?: 1 | 2;
    assignmentVersion: number;
    caseId: string;
    caseVersion: number;
    reviewerIdentityId: string;
    status: ReviewerAssignmentResultV1["status"];
  }>) => {
    const response = await rpc(name, values);
    if (response.error) throw new ReviewerAssignmentTransactionError(response.error.code);
    const parsed = resultSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.case_id !== expected.caseId
      || parsed.data.case_version !== expected.caseVersion
      || parsed.data.reviewer_identity_id !== expected.reviewerIdentityId
      || parsed.data.assignment_version !== expected.assignmentVersion
      || parsed.data.status !== expected.status
      || expected.assignmentId !== undefined && parsed.data.assignment_id !== expected.assignmentId
      || expected.assignmentSlot !== undefined
        && parsed.data.assignment_slot !== expected.assignmentSlot
      || !coherent(parsed.data)) {
      throw new Error("Reviewer assignment transaction returned an invalid result.");
    }
    return { approvalCounted: parsed.data.approval_counted,
      assignmentId: parsed.data.assignment_id, assignmentSlot: parsed.data.assignment_slot,
      assignmentVersion: parsed.data.assignment_version, caseId: parsed.data.case_id,
      caseVersion: parsed.data.case_version, cycleId: parsed.data.cycle_id,
      reasonClass: parsed.data.reason_class, releaseAuthorized: parsed.data.release_authorized,
      replayed: parsed.data.replayed,
      reviewerDecisionRecorded: parsed.data.reviewer_decision_recorded,
      reviewerIdentityId: parsed.data.reviewer_identity_id, status: parsed.data.status };
  };
  const terminal = (name: string, value: ReviewerAssignmentTerminalInputV1,
    status: "conflicted" | "recused") => call(name, {
      p_assignment_id: value.assignmentId, p_case_id: value.caseId,
      p_expected_assignment_version: value.expectedAssignmentVersion,
      p_expected_case_version: value.expectedCaseVersion,
      p_idempotency_key: value.idempotencyKey, p_reason_class: value.reasonClass,
      p_reviewer_identity_id: value.reviewerIdentityId,
    }, { assignmentId: value.assignmentId,
      assignmentVersion: value.expectedAssignmentVersion + 1, caseId: value.caseId,
      caseVersion: value.expectedCaseVersion, reviewerIdentityId: value.reviewerIdentityId,
      status });
  return {
    assign: (value) => call("claimant_assign_reviewer", {
      p_assignment_slot: value.assignmentSlot, p_case_id: value.caseId,
      p_cycle_id: value.cycleId, p_expected_case_version: value.expectedCaseVersion,
      p_idempotency_key: value.idempotencyKey,
      p_reviewer_identity_id: value.reviewerIdentityId,
    }, { assignmentSlot: value.assignmentSlot, assignmentVersion: 1,
      caseId: value.caseId, caseVersion: value.expectedCaseVersion,
      reviewerIdentityId: value.reviewerIdentityId, status: "assigned" }),
    declareConflict: (value) => terminal("claimant_declare_reviewer_conflict",
      value, "conflicted"),
    recuse: (value) => terminal("claimant_recuse_reviewer", value, "recused"),
  };
}

export function createReviewerAssignmentSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string;
  supabaseUrl: string;
}>): ReviewerAssignmentTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return createReviewerAssignmentTransactionClientV1((name, values) => supabase.rpc(name, values));
}

const resultSchema = z.strictObject({ approval_counted: z.literal(false),
  assignment_id: z.string().uuid(), assignment_slot: z.union([z.literal(1), z.literal(2)]),
  assignment_version: z.number().int().positive(), case_id: z.string().uuid(),
  case_version: z.number().int().min(2), cycle_id: z.string().uuid(),
  reason_class: z.enum(["availability", "case_involvement", "claimant_relationship",
    "independence_concern", "other_conflict", "owner_relationship"]).nullable(),
  release_authorized: z.literal(false), replayed: z.boolean(),
  reviewer_decision_recorded: z.literal(false), reviewer_identity_id: z.string().uuid(),
  status: z.enum(["assigned", "conflicted", "recused"]) });

function coherent(value: z.infer<typeof resultSchema>) {
  return value.status === "assigned" ? value.assignment_version === 1 && value.reason_class === null
    : value.assignment_version > 1 && value.reason_class !== null;
}
