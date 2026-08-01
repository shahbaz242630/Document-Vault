import { describe, expect, it } from "vitest";

import { claimantSyntheticEvidenceFixtures } from "./claimant-synthetic-evidence";

describe("synthetic claimant evidence fixtures", () => {
  it("covers four deterministic preparation outcomes", () => {
    expect(claimantSyntheticEvidenceFixtures.map(({ key }) => key)).toEqual([
      "partially-prepared",
      "ready-for-review",
      "unavailable",
      "invalid-metadata",
    ]);
    expect(claimantSyntheticEvidenceFixtures.map(({ preparation }) => preparation.status)).toEqual([
      "documents_needed",
      "ready_for_review",
      "manual_review",
      "manual_review",
    ]);
  });

  it("shows partial and complete preparation without authorizing release", () => {
    const partial = claimantSyntheticEvidenceFixtures[0]!.preparation;
    const ready = claimantSyntheticEvidenceFixtures[1]!.preparation;

    expect(partial.items.filter(({ availability }) => availability === "available")).toHaveLength(2);
    expect(partial.items.some(({ availability }) => availability === "pending")).toBe(true);
    expect(ready.items.every(({ availability }) => availability === "available")).toBe(true);
    expect(claimantSyntheticEvidenceFixtures.every(({ preparation }) => !preparation.release_authorized)).toBe(true);
  });

  it("fails closed for unavailable evidence and invalid metadata", () => {
    expect(claimantSyntheticEvidenceFixtures[2]!.preparation).toMatchObject({
      manual_review_reason: "document_unavailable",
      issues: [{ code: "document_unavailable" }],
    });
    expect(claimantSyntheticEvidenceFixtures[3]!.preparation).toMatchObject({
      manual_review_reason: "invalid_metadata",
      issues: [{ code: "invalid_display_label" }],
    });
    expect(
      claimantSyntheticEvidenceFixtures[3]!.preparation.items.every(
        ({ placeholder_ref }) => placeholder_ref === null,
      ),
    ).toBe(true);
  });
});
