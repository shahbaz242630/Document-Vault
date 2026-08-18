import { z } from "zod";

import type { IndependentReviewTransactionClientV1 }
  from "./independent-review-transaction-client.js";

export const CLAIMANT_INDEPENDENT_REVIEW_APPROVED = false as const;
export class IndependentReviewServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input") {
    super("Independent review is unavailable."); this.name = "IndependentReviewServiceError";
  }
}
export function createIndependentReviewServiceV1(input: Readonly<{
  approved?: boolean; transactions: IndependentReviewTransactionClientV1;
}>) {
  return { async record(value: unknown) {
    if (!(input.approved ?? CLAIMANT_INDEPENDENT_REVIEW_APPROVED)) {
      throw new IndependentReviewServiceError("disabled");
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success || !reasonMatches(parsed.data.decision, parsed.data.reasonClass)) {
      throw new IndependentReviewServiceError("invalid_input");
    }
    return input.transactions.record(parsed.data);
  } };
}
const uuid = z.string().uuid(); const positive = z.number().int().positive();
const digest = z.string().regex(/^[0-9a-f]{64}$/u);
const schema = z.strictObject({ assignmentId: uuid, caseId: uuid, checklistDigest: digest,
  cycleId: uuid, decision: z.enum(["allow", "hold", "reject"]),
  evidenceManifestDigest: digest, expectedAssignmentVersion: positive,
  expectedCaseVersion: positive, expectedIntakeVersion: positive,
  expectedPreparationVersion: positive, expectedSubmissionCaseVersion: positive,
  idempotencyKey: uuid, policyPackId: z.string().regex(/^synthetic_policy_[a-z0-9_]{1,100}$/u),
  policyPackVersion: positive, reasonClass: z.enum(["authority_not_established",
    "conflict_or_dispute", "evidence_inconsistent", "identity_not_established",
    "more_information_needed", "policy_review_required", "relationship_not_established",
    "requirements_satisfied"]), reviewerIdentityId: uuid });
function reasonMatches(decision: z.infer<typeof schema>["decision"], reason: string) {
  return decision === "allow" ? reason === "requirements_satisfied"
    : decision === "reject" ? ["authority_not_established", "identity_not_established",
      "relationship_not_established", "evidence_inconsistent"].includes(reason)
      : ["more_information_needed", "conflict_or_dispute", "policy_review_required"]
        .includes(reason);
}
