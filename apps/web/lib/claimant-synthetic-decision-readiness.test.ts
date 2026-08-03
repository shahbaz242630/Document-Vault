import { describe, expect, it } from "vitest";

import { claimantSyntheticDecisionReadinessViews } from "./claimant-synthetic-decision-readiness";

describe("synthetic claimant decision-readiness views", () => {
  it("uses neutral presentation identities", () => {
    expect(claimantSyntheticDecisionReadinessViews.map(({ key }) => key)).toEqual(
      Array.from({ length: 10 }, (_, index) => `example-${index + 1}`),
    );
  });

  it("keeps before/after delivery and blocked variants publicly identical", () => {
    const available = claimantSyntheticDecisionReadinessViews.filter(
      ({ projection }) => projection.stage === "retrieval_available",
    );
    const blocked = claimantSyntheticDecisionReadinessViews.filter(
      ({ projection }) => projection.stage === "retrieval_blocked",
    );
    expect(available).toHaveLength(2);
    expect(available[0]?.projection).toEqual(available[1]?.projection);
    expect(blocked).toHaveLength(2);
    expect(blocked[0]?.projection).toEqual(blocked[1]?.projection);
  });

  it("does not copy fixture identities or internal states into presentation data", () => {
    expect(JSON.stringify(claimantSyntheticDecisionReadinessViews)).not.toMatch(
      /available-before-delivery|available-after-delivery|blocked-one|blocked-two|invalid-input|release_ready|released|cancelled_by_owner|rejected/iu,
    );
  });
});
