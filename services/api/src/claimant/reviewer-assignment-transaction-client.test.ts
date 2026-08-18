import { describe, expect, it, vi } from "vitest";

import { createReviewerAssignmentTransactionClientV1, ReviewerAssignmentTransactionError }
  from "./reviewer-assignment-transaction-client.js";

const ids = { assignment: "a2000000-0000-4000-8000-000000000001",
  case: "a2000000-0000-4000-8000-000000000002",
  cycle: "a2000000-0000-4000-8000-000000000003",
  reviewer: "a2000000-0000-4000-8000-000000000004",
  attempt: "a2000000-0000-4000-8000-000000000005" };

describe("reviewer assignment transaction client", () => {
  it("maps exact service-only assignment, conflict, and recusal RPCs", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: result(), error: null })
      .mockResolvedValueOnce({ data: result({ assignment_version: 2,
        reason_class: "owner_relationship", status: "conflicted" }), error: null })
      .mockResolvedValueOnce({ data: result({ assignment_version: 2,
        reason_class: "availability", status: "recused" }), error: null });
    const client = createReviewerAssignmentTransactionClientV1(rpc);
    await expect(client.assign(assignment())).resolves.toMatchObject({ status: "assigned" });
    expect(rpc).toHaveBeenLastCalledWith("claimant_assign_reviewer", {
      p_assignment_slot: 1, p_case_id: ids.case, p_cycle_id: ids.cycle,
      p_expected_case_version: 5, p_idempotency_key: ids.attempt,
      p_reviewer_identity_id: ids.reviewer });
    await client.declareConflict(terminal("owner_relationship"));
    expect(rpc).toHaveBeenLastCalledWith("claimant_declare_reviewer_conflict",
      expect.objectContaining({ p_assignment_id: ids.assignment,
        p_reason_class: "owner_relationship" }));
    await client.recuse(terminal("availability"));
    expect(rpc).toHaveBeenLastCalledWith("claimant_recuse_reviewer",
      expect.objectContaining({ p_assignment_id: ids.assignment,
        p_reason_class: "availability" }));
  });

  it("redacts RPC detail and rejects extra or unsafe result authority", async () => {
    const failed = createReviewerAssignmentTransactionClientV1(vi.fn().mockResolvedValue({
      data: null, error: { code: "42501", message: "private evidence detail" } }));
    const error = await failed.assign(assignment()).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ReviewerAssignmentTransactionError);
    expect(JSON.stringify(error)).not.toContain("evidence");
    for (const hostile of [{ ...result(), release_authorized: true },
      { ...result(), reviewer_decision_recorded: true }, { ...result(), approval_counted: true },
      { ...result(), evidence_ref: "private" }, { ...result(), case_version: 6 },
      { ...result(), assignment_slot: 2 },
      { ...result(), status: "conflicted", reason_class: null }]) {
      const client = createReviewerAssignmentTransactionClientV1(vi.fn().mockResolvedValue({
        data: hostile, error: null }));
      await expect(client.assign(assignment())).rejects.toThrow("invalid result");
    }
  });

  it("cross-binds terminal results to assignment, reviewer, and version", async () => {
    for (const hostile of [{ ...result({ assignment_version: 2,
      reason_class: "availability", status: "recused" }), assignment_id: ids.cycle },
    { ...result({ assignment_version: 2, reason_class: "availability", status: "recused" }),
      reviewer_identity_id: ids.cycle },
    result({ assignment_version: 3, reason_class: "availability", status: "recused" })]) {
      const client = createReviewerAssignmentTransactionClientV1(vi.fn().mockResolvedValue({
        data: hostile, error: null }));
      await expect(client.recuse(terminal("availability"))).rejects.toThrow("invalid result");
    }
  });
});

function assignment() { return { assignmentSlot: 1 as const, caseId: ids.case,
  cycleId: ids.cycle, expectedCaseVersion: 5, idempotencyKey: ids.attempt,
  reviewerIdentityId: ids.reviewer }; }
function terminal(reasonClass: "availability" | "owner_relationship") {
  return { assignmentId: ids.assignment, caseId: ids.case, expectedAssignmentVersion: 1,
    expectedCaseVersion: 5, idempotencyKey: ids.attempt, reasonClass,
    reviewerIdentityId: ids.reviewer };
}
function result(changes = {}) { return { approval_counted: false, assignment_id: ids.assignment,
  assignment_slot: 1, assignment_version: 1, case_id: ids.case, case_version: 5,
  cycle_id: ids.cycle, reason_class: null, release_authorized: false, replayed: false,
  reviewer_decision_recorded: false, reviewer_identity_id: ids.reviewer,
  status: "assigned", ...changes }; }
