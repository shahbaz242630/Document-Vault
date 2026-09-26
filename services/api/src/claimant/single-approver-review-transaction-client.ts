import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;

/*
 * Slice 7A: the strict database client for the single-approver review path. Every result is parsed exactly and
 * cross-bound to the request; nothing returned carries a reason, evidence, key or grant.
 */
export type PrecheckInputV1 = Readonly<{ caseId: string; cycleId: string; phase: "decision" | "release";
  expectedCaseVersion: number; idempotencyKey: string }>;
export type SingleApproverDecisionInputV1 = Readonly<{ caseId: string; cycleId: string; assignmentId: string;
  reviewerIdentityId: string; precheckId: string; expectedCaseVersion: number;
  expectedAssignmentVersion: number; expectedSubmissionCaseVersion: number; expectedIntakeVersion: number;
  expectedPreparationVersion: number; policyPackId: string; policyPackVersion: number;
  checklistDigest: string; evidenceManifestDigest: string; decision: "allow" | "reject" | "hold";
  reasonClass: string; idempotencyKey: string }>;
export type ApprovalNoticeInputV1 = Readonly<{ caseId: string; reviewRoundId: string;
  expectedWindowVersion: number; outcome: "verified" | "failed"; evidenceDigest: string | null;
  idempotencyKey: string }>;
export type ApprovalHoldInputV1 = Readonly<{ caseId: string; reviewRoundId: string;
  expectedWindowVersion: number; actorClass: "owner" | "claimant" | "next_of_kin" | "system";
  actorUserId: string | null; reasonClass: "owner_cancelled" | "claimant_dispute" | "next_of_kin_dispute"
    | "material_change"; idempotencyKey: string }>;
export type SingleApproverReleaseInputV1 = Readonly<{ caseId: string; cycleId: string; reviewRoundId: string;
  authorityIdentityId: string; releasePrecheckId: string; expectedCaseVersion: number;
  expectedRoundVersion: number; expectedBindingVersion: number; expectedFinalizationVersion: number;
  expectedWindowVersion: number; freshAssuranceAt: string; idempotencyKey: string }>;

export class SingleApproverReviewTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Single-approver review transaction failed.");
    this.name = "SingleApproverReviewTransactionError";
  }
}

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const checkNames = ["policy_single_approver", "case_current", "claimant_is_not_owner", "owner_notice_verified",
  "cooldown_elapsed", "cooldown_meets_minimum", "submission_received", "checklist_complete", "evidence_complete",
  "no_other_open_claim", "no_intervention", "recipient_keys_current"] as const;
const decisionChecks = z.strictObject(Object.fromEntries([...checkNames, "round_not_decided"]
  .map((name) => [name, z.boolean()])) as Record<string, z.ZodBoolean>);
const releaseChecks = z.strictObject(Object.fromEntries([...checkNames, "round_single_approved",
  "evidence_unchanged_since_decision", "dispute_window_elapsed"].map((name) => [name, z.boolean()])) as
  Record<string, z.ZodBoolean>);
const precheckSchema = z.strictObject({ case_id: uuid, case_version: z.number().int().min(2), cycle_id: uuid,
  precheck_id: uuid, phase: z.enum(["decision", "release"]),
  check_set_version: z.literal("single_approver_prechecks_v1"), outcome: z.enum(["clear", "blocking"]),
  results: z.record(z.string(), z.boolean()), release_authorized: z.literal(false), replayed: z.boolean() });
const decisionSchema = z.strictObject({ case_id: uuid, case_version: z.number().int().min(2), cycle_id: uuid,
  review_round_id: uuid, round_version: z.literal(2), review_mode: z.literal("single_approver"),
  review_status: z.enum(["single_approved", "rejected", "held"]),
  dispute_window_status: z.literal("awaiting_notice").nullable(), release_authorized: z.literal(false),
  replayed: z.boolean() });
const windowSchema = z.strictObject({ case_id: uuid, review_round_id: uuid, window_version: z.number().int().min(2),
  dispute_window_status: z.enum(["open", "held"]), dispute_window_expires_at: timestamp.nullable().optional(),
  release_authorized: z.literal(false), replayed: z.boolean() });
const releaseSchema = z.strictObject({ case_id: uuid, case_version: z.number().int().min(3), case_state: z.literal("approved"),
  cycle_id: uuid, review_round_id: uuid, release_authorization_id: uuid, release_status: z.literal("authorized"),
  review_mode: z.literal("single_approver"), release_authorized: z.literal(true),
  package_creation_authorized: z.literal(false), retrieval_authorized: z.literal(false), replayed: z.boolean() });
const auditSchema = z.strictObject({ case_id: uuid, verified: z.boolean(), entries: z.array(z.strictObject({
  sequence: z.number().int().positive(), step: z.enum(["reviewer_assignment", "review", "intervention", "release",
    "single_approval"]), event_type: z.string().regex(/^[a-z_]{3,64}$/u), occurred_at: timestamp,
  entry_hash: z.string().regex(/^[0-9a-f]{64}$/u) })) });

export function createSingleApproverReviewTransactionClientV1(rpc: Rpc) {
  const invoke = async <T>(name: string, values: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> => {
    const response = await rpc(name, values);
    if (response.error) throw new SingleApproverReviewTransactionError(response.error.code);
    const parsed = schema.safeParse(response.data);
    if (!parsed.success) throw new Error("Single-approver review transaction returned an invalid result.");
    return parsed.data;
  };
  const bound = (ok: boolean) => {
    if (!ok) throw new Error("Single-approver review transaction returned an invalid binding.");
  };
  return {
    async runPrecheck(value: PrecheckInputV1) {
      const result = await invoke("claimant_run_review_precheck", { p_case_id: value.caseId,
        p_cycle_id: value.cycleId, p_phase: value.phase, p_expected_case_version: value.expectedCaseVersion,
        p_idempotency_key: value.idempotencyKey }, precheckSchema);
      const checks = (value.phase === "decision" ? decisionChecks : releaseChecks).safeParse(result.results);
      bound(checks.success && result.case_id === value.caseId && result.cycle_id === value.cycleId
        && result.phase === value.phase
        && (result.outcome === "clear") === Object.values(result.results).every(Boolean));
      return { caseId: result.case_id, caseVersion: result.case_version, cycleId: result.cycle_id,
        precheckId: result.precheck_id, phase: result.phase, outcome: result.outcome,
        results: Object.freeze({ ...result.results }), releaseAuthorized: false as const, replayed: result.replayed };
    },
    async recordDecision(value: SingleApproverDecisionInputV1) {
      const result = await invoke("claimant_record_single_approver_decision", { p_case_id: value.caseId,
        p_cycle_id: value.cycleId, p_assignment_id: value.assignmentId,
        p_reviewer_identity_id: value.reviewerIdentityId, p_precheck_id: value.precheckId,
        p_expected_case_version: value.expectedCaseVersion,
        p_expected_assignment_version: value.expectedAssignmentVersion,
        p_expected_submission_case_version: value.expectedSubmissionCaseVersion,
        p_expected_intake_version: value.expectedIntakeVersion,
        p_expected_preparation_version: value.expectedPreparationVersion, p_policy_pack_id: value.policyPackId,
        p_policy_pack_version: value.policyPackVersion, p_checklist_digest: value.checklistDigest,
        p_evidence_manifest_digest: value.evidenceManifestDigest, p_decision: value.decision,
        p_reason_class: value.reasonClass, p_idempotency_key: value.idempotencyKey }, decisionSchema);
      const expected = value.decision === "allow" ? "single_approved" : value.decision === "reject" ? "rejected" : "held";
      bound(result.case_id === value.caseId && result.cycle_id === value.cycleId
        && result.case_version === value.expectedCaseVersion && result.review_status === expected
        && (result.dispute_window_status === "awaiting_notice") === (expected === "single_approved"));
      return { caseId: result.case_id, cycleId: result.cycle_id, reviewRoundId: result.review_round_id,
        roundVersion: result.round_version, reviewStatus: result.review_status,
        disputeWindowStatus: result.dispute_window_status, releaseAuthorized: false as const,
        replayed: result.replayed };
    },
    async recordApprovalNotice(value: ApprovalNoticeInputV1) {
      const result = await invoke("claimant_record_approval_notice_delivery", { p_case_id: value.caseId,
        p_review_round_id: value.reviewRoundId, p_expected_window_version: value.expectedWindowVersion,
        p_outcome: value.outcome, p_evidence_digest: value.evidenceDigest,
        p_idempotency_key: value.idempotencyKey }, windowSchema);
      bound(result.case_id === value.caseId && result.review_round_id === value.reviewRoundId
        && result.window_version === value.expectedWindowVersion + 1
        && result.dispute_window_status === (value.outcome === "verified" ? "open" : "held"));
      return { reviewRoundId: result.review_round_id, windowVersion: result.window_version,
        disputeWindowStatus: result.dispute_window_status,
        disputeWindowExpiresAt: result.dispute_window_expires_at ?? null, replayed: result.replayed };
    },
    async holdApproval(value: ApprovalHoldInputV1) {
      const result = await invoke("claimant_hold_single_approval", { p_case_id: value.caseId,
        p_review_round_id: value.reviewRoundId, p_expected_window_version: value.expectedWindowVersion,
        p_actor_class: value.actorClass, p_actor_user_id: value.actorUserId, p_reason_class: value.reasonClass,
        p_idempotency_key: value.idempotencyKey }, windowSchema);
      bound(result.case_id === value.caseId && result.review_round_id === value.reviewRoundId
        && result.dispute_window_status === "held" && result.window_version === value.expectedWindowVersion + 1);
      return { reviewRoundId: result.review_round_id, windowVersion: result.window_version,
        disputeWindowStatus: "held" as const, replayed: result.replayed };
    },
    async authorizeRelease(value: SingleApproverReleaseInputV1) {
      const result = await invoke("claimant_authorize_single_approver_release", { p_case_id: value.caseId,
        p_cycle_id: value.cycleId, p_review_round_id: value.reviewRoundId,
        p_authority_identity_id: value.authorityIdentityId, p_release_precheck_id: value.releasePrecheckId,
        p_expected_case_version: value.expectedCaseVersion, p_expected_round_version: value.expectedRoundVersion,
        p_expected_binding_version: value.expectedBindingVersion,
        p_expected_finalization_version: value.expectedFinalizationVersion,
        p_expected_window_version: value.expectedWindowVersion, p_fresh_assurance_at: value.freshAssuranceAt,
        p_idempotency_key: value.idempotencyKey }, releaseSchema);
      bound(result.case_id === value.caseId && result.cycle_id === value.cycleId
        && result.review_round_id === value.reviewRoundId && result.case_version === value.expectedCaseVersion + 1);
      return { caseId: result.case_id, caseVersion: result.case_version, caseState: result.case_state,
        releaseAuthorizationId: result.release_authorization_id, reviewMode: result.review_mode,
        releaseAuthorized: true as const, packageCreationAuthorized: false as const,
        retrievalAuthorized: false as const, replayed: result.replayed };
    },
    async exportAudit(caseId: string) {
      const result = await invoke("claimant_export_review_audit", { p_case_id: caseId }, auditSchema);
      bound(result.case_id === caseId && result.entries.every((entry, index) => entry.sequence === index + 1));
      return { caseId: result.case_id, verified: result.verified, entries: Object.freeze(result.entries.map((entry) =>
        Object.freeze({ sequence: entry.sequence, step: entry.step, eventType: entry.event_type,
          occurredAt: entry.occurred_at, entryHash: entry.entry_hash }))) };
    },
  };
}

export type SingleApproverReviewTransactionClientV1 = ReturnType<typeof createSingleApproverReviewTransactionClientV1>;

export function createSingleApproverReviewSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): SingleApproverReviewTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return createSingleApproverReviewTransactionClientV1((name, values) => supabase.rpc(name, values));
}
