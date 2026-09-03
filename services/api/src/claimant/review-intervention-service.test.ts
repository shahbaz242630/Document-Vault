import { describe, expect, it, vi } from "vitest";
import { CLAIMANT_REVIEW_INTERVENTION_APPROVED, createReviewInterventionServiceV1 }
  from "./review-intervention-service.js";

const id = (last: string) => `b3000000-0000-4000-8000-0000000000${last}`;
describe("review intervention service", () => {
  it("is literal-false and performs no transaction while disabled", async () => {
    expect(CLAIMANT_REVIEW_INTERVENTION_APPROVED).toBe(false);
    const transactions = { open: vi.fn() };
    await expect(createReviewInterventionServiceV1({ transactions }).open(valid()))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(transactions.open).not.toHaveBeenCalled();
  });
  it("passes exact escalation and appeal inputs only when explicitly enabled", async () => {
    const transactions = { open: vi.fn() };
    const service = createReviewInterventionServiceV1({ approved: true, transactions });
    await service.open(valid());
    await service.open(valid({ interventionType: "appeal",
      reasonClass: "new_material_information" }));
    expect(transactions.open).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed or extra authority", async () => {
    const service = createReviewInterventionServiceV1({ approved: true,
      transactions: { open: vi.fn() } });
    for (const value of [valid({ expectedRoundVersion: 0 }),
      valid({ reasonClass: "requirements_satisfied" }), valid({ releaseAuthorized: true })]) {
      await expect(service.open(value)).rejects.toMatchObject({ kind: "invalid_input" });
    }
  });
});
function valid(changes = {}) { return { authorityIdentityId: id("01"), caseId: id("02"),
  cycleId: id("03"), expectedCaseVersion: 5, expectedRoundVersion: 2,
  idempotencyKey: id("04"), interventionType: "escalation" as const,
  reasonClass: "independence_concern" as const, reviewRoundId: id("05"), ...changes }; }
