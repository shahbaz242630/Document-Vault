import { describe, expect, it } from "vitest";

import {
  claimantChecklistCatalogue,
  claimantCommonChecklistItemKeys,
} from "./catalogue";
import { claimantChecklistItemKeys } from "./contracts";

describe("claimant checklist catalogue", () => {
  it("defines every item once with a safe explanation", () => {
    expect(Object.keys(claimantChecklistCatalogue).sort()).toEqual(
      [...claimantChecklistItemKeys].sort(),
    );
    expect(new Set(claimantChecklistItemKeys).size).toBe(
      claimantChecklistItemKeys.length,
    );

    for (const item of Object.values(claimantChecklistCatalogue)) {
      expect(item.label.length).toBeGreaterThan(3);
      expect(item.explanation.length).toBeGreaterThan(20);
    }
  });

  it("keeps the minimum common checklist separate from conditional modules", () => {
    expect(claimantCommonChecklistItemKeys).toEqual([
      "claimant_photo_identity",
      "identity_verification_result",
      "owner_match_reference",
      "official_death_record",
      "authority_basis",
      "processing_declaration",
      "conflict_declaration",
    ]);
    expect(claimantCommonChecklistItemKeys).not.toContain("probate_authority");
    expect(claimantCommonChecklistItemKeys).not.toContain("certified_translation");
  });
});
