import { describe, expect, it, vi } from "vitest";
import { createReviewInterventionTransactionClientV1, ReviewInterventionTransactionError }
  from "./review-intervention-transaction-client.js";

const id = (last: string) => `b4000000-0000-4000-8000-0000000000${last}`;
describe("review intervention transaction client", () => {
  it("maps exact authority and accepts only a held, immutable-false result", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result(), error: null });
    await expect(createReviewInterventionTransactionClientV1(rpc).open(input()))
      .resolves.toMatchObject({ reviewStatus: "held", releaseAuthorized: false,
        twoPersonApprovalSatisfied: false });
    expect(rpc).toHaveBeenCalledWith("claimant_open_review_intervention",
      expect.objectContaining({ p_authority_identity_id: id("01"),
        p_expected_round_version: 2, p_intervention_type: "escalation" }));
  });
  it("redacts transaction errors", async () => {
    const failed = createReviewInterventionTransactionClientV1(vi.fn().mockResolvedValue({
      data: null, error: { code: "42501", message: "private authority" } }));
    const error = await failed.open(input()).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ReviewInterventionTransactionError);
    expect(JSON.stringify(error)).not.toContain("private authority");
  });
  it("rejects unsafe, extra, cross-case, stale, or incoherent output", async () => {
    for (const hostile of [{ ...result(), release_authorized: true },
      { ...result(), resolution: "approved" }, { ...result(), case_id: id("09") },
      { ...result(), round_version: 2 }, { ...result(), review_status: "rejected" },
      { ...result(), two_person_approval_satisfied: true }]) {
      await expect(createReviewInterventionTransactionClientV1(vi.fn().mockResolvedValue({
        data: hostile, error: null })).open(input())).rejects.toThrow("invalid result");
    }
  });
});
function input() { return { authorityIdentityId: id("01"), caseId: id("02"),
  cycleId: id("03"), expectedCaseVersion: 5, expectedRoundVersion: 2,
  idempotencyKey: id("04"), interventionType: "escalation" as const,
  reasonClass: "independence_concern" as const, reviewRoundId: id("05") }; }
function result(changes = {}) { return { case_id: id("02"), case_version: 5,
  cycle_id: id("03"), intervention_id: id("06"), intervention_status: "open",
  intervention_type: "escalation", release_authorized: false, replayed: false,
  review_round_id: id("05"), review_status: "held", round_version: 3,
  two_person_approval_satisfied: false, ...changes }; }
