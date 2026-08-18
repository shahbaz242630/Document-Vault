import { z } from "zod";

import type { ReviewerAssignmentTransactionClientV1 }
  from "./reviewer-assignment-transaction-client.js";

export const CLAIMANT_REVIEWER_ASSIGNMENT_APPROVED = false as const;

export class ReviewerAssignmentServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input") {
    super("Reviewer assignment is unavailable.");
    this.name = "ReviewerAssignmentServiceError";
  }
}

export function createReviewerAssignmentServiceV1(input: Readonly<{
  approved?: boolean;
  transactions: ReviewerAssignmentTransactionClientV1;
}>) {
  const approved = () => {
    if (!(input.approved ?? CLAIMANT_REVIEWER_ASSIGNMENT_APPROVED)) {
      throw new ReviewerAssignmentServiceError("disabled");
    }
  };
  return {
    async assign(value: unknown) {
      approved(); const parsed = assignSchema.safeParse(value);
      if (!parsed.success) invalid();
      return input.transactions.assign(parsed.data);
    },
    async declareConflict(value: unknown) {
      approved(); const parsed = conflictSchema.safeParse(value);
      if (!parsed.success) invalid();
      return input.transactions.declareConflict(parsed.data);
    },
    async recuse(value: unknown) {
      approved(); const parsed = recusalSchema.safeParse(value);
      if (!parsed.success) invalid();
      return input.transactions.recuse(parsed.data);
    },
  };
}

const uuid = z.string().uuid();
const positive = z.number().int().positive();
const terminalBase = { assignmentId: uuid, caseId: uuid, expectedAssignmentVersion: positive,
  expectedCaseVersion: positive, idempotencyKey: uuid, reviewerIdentityId: uuid };
const assignSchema = z.strictObject({ assignmentSlot: z.union([z.literal(1), z.literal(2)]),
  caseId: uuid, cycleId: uuid, expectedCaseVersion: positive, idempotencyKey: uuid,
  reviewerIdentityId: uuid });
const conflictSchema = z.strictObject({ ...terminalBase,
  reasonClass: z.enum(["case_involvement", "claimant_relationship", "independence_concern",
    "other_conflict", "owner_relationship"]) });
const recusalSchema = z.strictObject({ ...terminalBase,
  reasonClass: z.enum(["availability", "independence_concern", "other_conflict"]) });

function invalid(): never { throw new ReviewerAssignmentServiceError("invalid_input"); }
