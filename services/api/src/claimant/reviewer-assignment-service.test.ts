import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_REVIEWER_ASSIGNMENT_APPROVED, createReviewerAssignmentServiceV1,
  ReviewerAssignmentServiceError } from "./reviewer-assignment-service.js";

const ids = { assignment: "a1000000-0000-4000-8000-000000000001",
  case: "a1000000-0000-4000-8000-000000000002",
  cycle: "a1000000-0000-4000-8000-000000000003",
  reviewer: "a1000000-0000-4000-8000-000000000004",
  attempt: "a1000000-0000-4000-8000-000000000005" };

describe("reviewer assignment service", () => {
  it("is immutable-false and touches no transaction while disabled", async () => {
    expect(CLAIMANT_REVIEWER_ASSIGNMENT_APPROVED).toBe(false);
    const transactions = mocks();
    await expect(createReviewerAssignmentServiceV1({ transactions }).assign(assignment()))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(transactions.assign).not.toHaveBeenCalled();
  });

  it("passes exact bounded assignment, conflict, and recusal inputs", async () => {
    const transactions = mocks();
    const service = createReviewerAssignmentServiceV1({ approved: true, transactions });
    await service.assign(assignment());
    await service.declareConflict(terminal("owner_relationship"));
    await service.recuse(terminal("availability"));
    expect(transactions.assign).toHaveBeenCalledWith(assignment());
    expect(transactions.declareConflict).toHaveBeenCalledWith(terminal("owner_relationship"));
    expect(transactions.recuse).toHaveBeenCalledWith(terminal("availability"));
  });

  it("rejects extra authority, invalid slots, and reason crossover", async () => {
    const service = createReviewerAssignmentServiceV1({ approved: true, transactions: mocks() });
    for (const value of [{ ...assignment(), assignmentSlot: 3 },
      { ...assignment(), releaseAuthorized: true }]) {
      await expect(service.assign(value)).rejects.toBeInstanceOf(ReviewerAssignmentServiceError);
    }
    await expect(service.declareConflict(terminal("availability")))
      .rejects.toMatchObject({ kind: "invalid_input" });
    await expect(service.recuse(terminal("owner_relationship")))
      .rejects.toMatchObject({ kind: "invalid_input" });
  });
});

function mocks() { return { assign: vi.fn(), declareConflict: vi.fn(), recuse: vi.fn() }; }
function assignment() { return { assignmentSlot: 1 as const, caseId: ids.case,
  cycleId: ids.cycle, expectedCaseVersion: 5, idempotencyKey: ids.attempt,
  reviewerIdentityId: ids.reviewer }; }
function terminal(reasonClass: string) { return { assignmentId: ids.assignment,
  caseId: ids.case, expectedAssignmentVersion: 1, expectedCaseVersion: 5,
  idempotencyKey: ids.attempt, reasonClass, reviewerIdentityId: ids.reviewer }; }
