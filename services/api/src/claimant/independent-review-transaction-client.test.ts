import { describe, expect, it, vi } from "vitest";
import { createIndependentReviewTransactionClientV1, IndependentReviewTransactionError }
  from "./independent-review-transaction-client.js";

const id = (last: string) => `b2000000-0000-4000-8000-0000000000${last}`;
describe("independent review transaction client", () => {
  it("maps exact authority and accepts only aggregate blind results", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result(), error: null });
    await expect(createIndependentReviewTransactionClientV1(rpc).record(input()))
      .resolves.toMatchObject({ reviewStatus: "pending", releaseAuthorized: false });
    expect(rpc).toHaveBeenCalledWith("claimant_record_independent_review",
      expect.objectContaining({ p_assignment_id: id("01"), p_checklist_digest: "a".repeat(64),
        p_decision: "allow", p_expected_submission_case_version: 3,
        p_reviewer_identity_id: id("05") }));
  });
  it("accepts coherent aggregate completion without exposing either decision", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result({ review_complete: true,
      review_status: "two_person_approved", round_version: 2,
      two_person_approval_satisfied: true }), error: null });
    await expect(createIndependentReviewTransactionClientV1(rpc).record(input()))
      .resolves.toMatchObject({ reviewComplete: true, twoPersonApprovalSatisfied: true });
  });
  it("redacts errors and rejects unsafe, extra, cross-case, or incoherent output", async () => {
    const failed = createIndependentReviewTransactionClientV1(vi.fn().mockResolvedValue({
      data: null, error: { code: "42501", message: "private evidence" } }));
    const error = await failed.record(input()).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(IndependentReviewTransactionError);
    expect(JSON.stringify(error)).not.toContain("evidence");
    for (const hostile of [{ ...result(), release_authorized: true },
      { ...result(), first_reviewer_decision: "allow" }, { ...result(), case_id: id("09") },
      { ...result(), review_complete: true }, { ...result(), two_person_approval_satisfied: true }]) {
      await expect(createIndependentReviewTransactionClientV1(vi.fn().mockResolvedValue({
        data: hostile, error: null })).record(input())).rejects.toThrow("invalid result");
    }
  });
});
function input() { return { assignmentId: id("01"), caseId: id("02"),
  checklistDigest: "a".repeat(64), cycleId: id("03"), decision: "allow" as const,
  evidenceManifestDigest: "b".repeat(64), expectedAssignmentVersion: 1,
  expectedCaseVersion: 5, expectedIntakeVersion: 9, expectedPreparationVersion: 9,
  expectedSubmissionCaseVersion: 3, idempotencyKey: id("04"),
  policyPackId: "synthetic_policy_death_alpha", policyPackVersion: 1,
  reasonClass: "requirements_satisfied" as const, reviewerIdentityId: id("05") }; }
function result(changes = {}) { return { case_id: id("02"), case_version: 5,
  cycle_id: id("03"), release_authorized: false, replayed: false, review_complete: false,
  review_round_id: id("06"), review_status: "pending", round_version: 1,
  two_person_approval_satisfied: false, ...changes }; }
