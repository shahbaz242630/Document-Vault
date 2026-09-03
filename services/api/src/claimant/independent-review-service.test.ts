import { describe, expect, it, vi } from "vitest";
import { CLAIMANT_INDEPENDENT_REVIEW_APPROVED, createIndependentReviewServiceV1 }
  from "./independent-review-service.js";

const id = (last: string) => `b1000000-0000-4000-8000-0000000000${last}`;
describe("independent review service", () => {
  it("is literal-false and performs no transaction while disabled", async () => {
    expect(CLAIMANT_INDEPENDENT_REVIEW_APPROVED).toBe(false); const transactions = { record: vi.fn() };
    await expect(createIndependentReviewServiceV1({ transactions }).record(valid()))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(transactions.record).not.toHaveBeenCalled();
  });
  it("passes exact allow, reject, and hold inputs when explicitly enabled", async () => {
    const transactions = { record: vi.fn() };
    const service = createIndependentReviewServiceV1({ approved: true, transactions });
    for (const value of [valid(), valid({ decision: "reject",
      reasonClass: "authority_not_established" }), valid({ decision: "hold",
      reasonClass: "more_information_needed" })]) await service.record(value);
    expect(transactions.record).toHaveBeenCalledTimes(3);
  });
  it("rejects reason crossover, malformed digests, and extra authority", async () => {
    const service = createIndependentReviewServiceV1({ approved: true,
      transactions: { record: vi.fn() } });
    for (const value of [valid({ reasonClass: "more_information_needed" }),
      valid({ checklistDigest: "a" }), valid({ releaseAuthorized: true })]) {
      await expect(service.record(value)).rejects.toMatchObject({ kind: "invalid_input" });
    }
  });
});
function valid(changes = {}) { return { assignmentId: id("01"), caseId: id("02"),
  checklistDigest: "a".repeat(64), cycleId: id("03"), decision: "allow" as const,
  evidenceManifestDigest: "b".repeat(64), expectedAssignmentVersion: 1,
  expectedCaseVersion: 5, expectedIntakeVersion: 9, expectedPreparationVersion: 9,
  expectedSubmissionCaseVersion: 3, idempotencyKey: id("04"),
  policyPackId: "synthetic_policy_death_alpha", policyPackVersion: 1,
  reasonClass: "requirements_satisfied" as const, reviewerIdentityId: id("05"), ...changes }; }
