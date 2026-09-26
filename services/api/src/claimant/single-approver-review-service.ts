import { z } from "zod";

import type { SingleApproverReviewTransactionClientV1 } from "./single-approver-review-transaction-client.js";

/*
 * Slice 7A: one accountable human approver. Pre-checks can only block; the approval opens a dispute window; the
 * release needs the same person to re-confirm with fresh MFA after the window. Unmounted and literal false.
 */
export const CLAIMANT_SINGLE_APPROVER_REVIEW_APPROVED = false as const;

export class SingleApproverReviewServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input") {
    super("Single-approver review is unavailable.");
    this.name = "SingleApproverReviewServiceError";
  }
}

const uuid = z.string().uuid();
const version = z.number().int().positive();
const digest = z.string().regex(/^[0-9a-f]{64}$/u);
const decisionReasons = { allow: ["requirements_satisfied"], reject: ["authority_not_established",
  "identity_not_established", "relationship_not_established", "evidence_inconsistent"],
hold: ["more_information_needed", "conflict_or_dispute", "policy_review_required"] } as const;

const precheck = z.strictObject({ caseId: uuid, cycleId: uuid, phase: z.enum(["decision", "release"]),
  expectedCaseVersion: version, idempotencyKey: uuid });
const decision = z.strictObject({ caseId: uuid, cycleId: uuid, assignmentId: uuid, reviewerIdentityId: uuid,
  precheckId: uuid, expectedCaseVersion: version, expectedAssignmentVersion: version,
  expectedSubmissionCaseVersion: version, expectedIntakeVersion: version, expectedPreparationVersion: version,
  policyPackId: z.string().regex(/^synthetic_policy_[a-z0-9_]{1,100}$/u), policyPackVersion: version,
  checklistDigest: digest, evidenceManifestDigest: digest, decision: z.enum(["allow", "reject", "hold"]),
  reasonClass: z.string(), idempotencyKey: uuid })
  .refine((value) => (decisionReasons[value.decision] as readonly string[]).includes(value.reasonClass));
const notice = z.strictObject({ caseId: uuid, reviewRoundId: uuid, expectedWindowVersion: version,
  outcome: z.enum(["verified", "failed"]), evidenceDigest: digest.nullable(), idempotencyKey: uuid })
  .refine((value) => (value.outcome === "verified") === (value.evidenceDigest !== null));
const hold = z.strictObject({ caseId: uuid, reviewRoundId: uuid, expectedWindowVersion: version,
  actorClass: z.enum(["owner", "claimant", "next_of_kin", "system"]), actorUserId: uuid.nullable(),
  reasonClass: z.enum(["owner_cancelled", "claimant_dispute", "next_of_kin_dispute", "material_change"]),
  idempotencyKey: uuid })
  .refine((value) => ({ owner: "owner_cancelled", claimant: "claimant_dispute", next_of_kin: "next_of_kin_dispute",
    system: "material_change" })[value.actorClass] === value.reasonClass
    && (value.actorClass === "system") === (value.actorUserId === null));
const release = z.strictObject({ caseId: uuid, cycleId: uuid, reviewRoundId: uuid, authorityIdentityId: uuid,
  releasePrecheckId: uuid, expectedCaseVersion: version, expectedRoundVersion: version,
  expectedBindingVersion: version, expectedFinalizationVersion: version, expectedWindowVersion: version,
  freshAssuranceAt: z.string().datetime({ offset: true }), idempotencyKey: uuid });

export function createSingleApproverReviewServiceV1(input: Readonly<{
  approved?: boolean; transactions: SingleApproverReviewTransactionClientV1;
}>) {
  function guard<T>(schema: z.ZodType<T>, value: unknown): T {
    if (!(input.approved ?? CLAIMANT_SINGLE_APPROVER_REVIEW_APPROVED)) {
      throw new SingleApproverReviewServiceError("disabled");
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new SingleApproverReviewServiceError("invalid_input");
    return parsed.data;
  }
  return Object.freeze({
    runPrecheck: (value: unknown) => input.transactions.runPrecheck(guard(precheck, value)),
    recordDecision: (value: unknown) => input.transactions.recordDecision(guard(decision, value)),
    recordApprovalNotice: (value: unknown) => input.transactions.recordApprovalNotice(guard(notice, value)),
    holdApproval: (value: unknown) => input.transactions.holdApproval(guard(hold, value)),
    authorizeRelease: (value: unknown) => input.transactions.authorizeRelease(guard(release, value)),
    exportAudit: (caseId: unknown) => input.transactions.exportAudit(guard(uuid, caseId)),
  });
}
