import { describe, expect, it } from "vitest";

import { claimantSyntheticChecklistFixtures } from "./claimant-synthetic-checklist";

describe("synthetic claimant checklist fixtures", () => {
  it("covers four deterministic policy outcomes", () => {
    expect(claimantSyntheticChecklistFixtures.map(({ key }) => key)).toEqual([
      "documents-needed",
      "ready-for-review",
      "unavailable",
      "missing-policy",
    ]);

    expect(claimantSyntheticChecklistFixtures.map(({ checklist }) => checklist.status)).toEqual([
      "documents_needed",
      "ready_for_review",
      "manual_review",
      "manual_review",
    ]);
  });

  it("selects conditional requirements without granting release", () => {
    const documentsNeeded = claimantSyntheticChecklistFixtures[0]!.checklist;
    const readyForReview = claimantSyntheticChecklistFixtures[1]!.checklist;

    expect(documentsNeeded.items.at(-1)).toMatchObject({
      key: "probate_authority",
      source: "conditional",
      availability: "pending",
    });
    expect(readyForReview.items.at(-1)).toMatchObject({
      key: "relationship_evidence",
      source: "conditional",
      availability: "available",
    });
    expect(claimantSyntheticChecklistFixtures.every(({ checklist }) => !checklist.release_authorized)).toBe(true);
  });

  it("fails closed for unavailable documents and missing policy", () => {
    const unavailable = claimantSyntheticChecklistFixtures[2]!.checklist;
    const missingPolicy = claimantSyntheticChecklistFixtures[3]!.checklist;

    expect(unavailable.manual_review_reason).toBe("document_unavailable");
    expect(unavailable.items.at(-1)).toMatchObject({
      key: "certified_translation",
      availability: "not_available",
    });
    expect(missingPolicy).toMatchObject({
      status: "manual_review",
      manual_review_reason: "missing_policy",
      policy_id: null,
      items: [],
    });
  });
});
