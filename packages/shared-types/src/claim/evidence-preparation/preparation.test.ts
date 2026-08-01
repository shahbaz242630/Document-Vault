import { describe, expect, it } from "vitest";

import {
  createSyntheticChecklistRoutingFacts,
  renderSyntheticClaimantChecklist,
} from "../checklist";
import {
  createSyntheticEvidenceBundle,
  createSyntheticEvidencePlaceholder,
  prepareSyntheticEvidence,
  syntheticEvidenceChecklist,
  syntheticEvidenceServerTime,
} from "./index";

describe("synthetic evidence preparation", () => {
  it("keeps incomplete bundles in documents-needed without creating issues", () => {
    const firstItem = syntheticEvidenceChecklist.items[0]!;
    const result = prepareSyntheticEvidence({
      bundle: createSyntheticEvidenceBundle({
        placeholders: [createSyntheticEvidencePlaceholder(firstItem.key, 1)],
      }),
      checklist: syntheticEvidenceChecklist,
      server_time: syntheticEvidenceServerTime,
    });

    expect(result.status).toBe("documents_needed");
    expect(result.manual_review_reason).toBeNull();
    expect(result.items[0]).toMatchObject({
      key: firstItem.key,
      availability: "available",
      placeholder_ref: "synthetic_evidence_001",
    });
    expect(result.items.slice(1).every(({ availability }) => availability === "pending")).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.release_authorized).toBe(false);
  });

  it("marks a complete valid bundle ready only for controlled review", () => {
    const placeholders = syntheticEvidenceChecklist.items.map(({ key }, index) =>
      createSyntheticEvidencePlaceholder(key, index + 1),
    );
    const result = prepareSyntheticEvidence({
      bundle: createSyntheticEvidenceBundle({ placeholders }),
      checklist: syntheticEvidenceChecklist,
      server_time: syntheticEvidenceServerTime,
    });

    expect(result.status).toBe("ready_for_review");
    expect(result.items.every(({ availability }) => availability === "available")).toBe(true);
    expect(result.release_authorized).toBe(false);
  });

  it("routes unavailable evidence to manual review", () => {
    const unavailableKey = syntheticEvidenceChecklist.items[2]!.key;
    const result = prepareSyntheticEvidence({
      bundle: createSyntheticEvidenceBundle({ unavailable_items: [unavailableKey] }),
      checklist: syntheticEvidenceChecklist,
      server_time: syntheticEvidenceServerTime,
    });

    expect(result).toMatchObject({
      status: "manual_review",
      manual_review_reason: "document_unavailable",
      release_authorized: false,
    });
    expect(result.items.find(({ key }) => key === unavailableKey)?.availability).toBe(
      "not_available",
    );
  });

  it("does not accept any placeholder when one metadata record is malformed", () => {
    const valid = createSyntheticEvidencePlaceholder(
      syntheticEvidenceChecklist.items[0]!.key,
      1,
    );
    const malformed = {
      ...createSyntheticEvidencePlaceholder(syntheticEvidenceChecklist.items[1]!.key, 2),
      display_label: "real-person-document.pdf",
    } as never;
    const result = prepareSyntheticEvidence({
      bundle: createSyntheticEvidenceBundle({ placeholders: [valid, malformed] }),
      checklist: syntheticEvidenceChecklist,
      server_time: syntheticEvidenceServerTime,
    });

    expect(result.status).toBe("manual_review");
    expect(result.manual_review_reason).toBe("invalid_metadata");
    expect(result.items.every(({ availability }) => availability === "pending")).toBe(true);
    expect(result.items.every(({ placeholder_ref }) => placeholder_ref === null)).toBe(true);
  });

  it("fails closed when the bundle is bound to another policy version", () => {
    const bundle = {
      ...createSyntheticEvidenceBundle(),
      policy_version: syntheticEvidenceChecklist.policy_version! + 1,
    };
    const result = prepareSyntheticEvidence({
      bundle,
      checklist: syntheticEvidenceChecklist,
      server_time: syntheticEvidenceServerTime,
    });

    expect(result).toMatchObject({
      status: "manual_review",
      manual_review_reason: "binding_mismatch",
      release_authorized: false,
      issues: [{ code: "policy_binding_mismatch" }],
    });
  });

  it("refuses preparation when the checklist has no applicable policy", () => {
    const missingPolicyChecklist = renderSyntheticClaimantChecklist({
      packs: [],
      facts: createSyntheticChecklistRoutingFacts(),
      server_time: syntheticEvidenceServerTime,
    });
    const result = prepareSyntheticEvidence({
      bundle: createSyntheticEvidenceBundle(),
      checklist: missingPolicyChecklist,
      server_time: syntheticEvidenceServerTime,
    });

    expect(result).toMatchObject({
      status: "manual_review",
      manual_review_reason: "checklist_unavailable",
      policy_id: null,
      policy_version: null,
      release_authorized: false,
      items: [],
      issues: [{ code: "checklist_unavailable" }],
    });
  });
});
