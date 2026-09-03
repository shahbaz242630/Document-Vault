import { z } from "zod";

import type { ReviewInterventionTransactionClientV1 }
  from "./review-intervention-transaction-client.js";

export const CLAIMANT_REVIEW_INTERVENTION_APPROVED = false as const;

export class ReviewInterventionServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input") {
    super("Review intervention is unavailable.");
    this.name = "ReviewInterventionServiceError";
  }
}

export function createReviewInterventionServiceV1(input: Readonly<{
  approved?: boolean; transactions: ReviewInterventionTransactionClientV1;
}>) {
  return { async open(value: unknown) {
    if (!(input.approved ?? CLAIMANT_REVIEW_INTERVENTION_APPROVED)) {
      throw new ReviewInterventionServiceError("disabled");
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new ReviewInterventionServiceError("invalid_input");
    return input.transactions.open(parsed.data);
  } };
}

const uuid = z.string().uuid();
const positive = z.number().int().positive();
const schema = z.strictObject({ authorityIdentityId: uuid, caseId: uuid, cycleId: uuid,
  expectedCaseVersion: positive, expectedRoundVersion: positive, idempotencyKey: uuid,
  interventionType: z.enum(["appeal", "escalation"]), reasonClass: z.enum([
    "conflict_or_dispute", "independence_concern", "new_material_information",
    "policy_review_required", "procedural_error"]), reviewRoundId: uuid });
