import { describe, expect, it } from "vitest";

import { syntheticChecklistPolicyDraft } from "./fixtures";
import {
  computeSyntheticChecklistChecksum,
  createSyntheticChecklistPolicyPack,
  hasValidSyntheticChecklistChecksum,
} from "./synthetic-integrity";

describe("synthetic checklist integrity", () => {
  it("is deterministic and explicitly non-cryptographic", () => {
    const first = computeSyntheticChecklistChecksum(syntheticChecklistPolicyDraft);
    const second = computeSyntheticChecklistChecksum({
      ...syntheticChecklistPolicyDraft,
      conditional_rules: [...syntheticChecklistPolicyDraft.conditional_rules],
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^synthetic_checksum_[0-9a-f]{8}$/u);
    expect(syntheticChecklistPolicyDraft.integrity.algorithm).toBe(
      "synthetic_fnv1a32_not_cryptographic",
    );
  });

  it("detects fixture mutation without claiming production signature security", () => {
    const pack = createSyntheticChecklistPolicyPack(syntheticChecklistPolicyDraft);
    const tampered = {
      ...pack,
      accountable_approver_ref: "synthetic_approver_changed",
    };

    expect(hasValidSyntheticChecklistChecksum(pack)).toBe(true);
    expect(hasValidSyntheticChecklistChecksum(tampered)).toBe(false);
    expect(pack.production_approved).toBe(false);
  });
});
