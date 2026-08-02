import { describe, expect, it } from "vitest";

import { claimantSyntheticReviewTrackingViews } from "./claimant-synthetic-review-tracking";

describe("synthetic claimant review-tracking views", () => {
  it("uses neutral presentation identities", () => {
    expect(claimantSyntheticReviewTrackingViews.map(({ key }) => key)).toEqual([
      "example-1",
      "example-2",
      "example-3",
      "example-4",
      "example-5",
      "example-6",
      "example-7",
    ]);
  });

  it("renders stopped and malformed inputs through the same limited view", () => {
    const limited = claimantSyntheticReviewTrackingViews.filter(
      ({ projection }) => projection.stage === "status_unavailable",
    );
    expect(limited).toHaveLength(2);
    expect(limited[0]?.label).toBe("Limited tracking view");
    expect(limited[1]?.label).toBe("Limited tracking view");
    expect(limited[0]?.projection).toEqual(limited[1]?.projection);
  });

  it("does not copy synthetic fixture keys or internal states into presentation data", () => {
    expect(JSON.stringify(claimantSyntheticReviewTrackingViews)).not.toMatch(
      /stopped-outcome|invalid-input|cancelled_by_owner|review_pending|cooldown|approved/iu,
    );
  });
});
