import { describe, expect, it } from "vitest";

import {
  createSyntheticEvidenceBundle,
  createSyntheticEvidencePlaceholder,
  syntheticEvidenceChecklist,
  syntheticEvidencePlaceholderSizeLimitBytes,
  syntheticEvidenceServerTime,
  type SyntheticEvidenceBundleV1,
  validateSyntheticEvidenceBundle,
} from "./index";

describe("synthetic evidence metadata validation", () => {
  it("accepts deterministic placeholders bound to selected checklist items", () => {
    const placeholder = createSyntheticEvidencePlaceholder(
      syntheticEvidenceChecklist.items[0]!.key,
      1,
    );
    const result = validateSyntheticEvidenceBundle({
      bundle: createSyntheticEvidenceBundle({ placeholders: [placeholder] }),
      checklist: syntheticEvidenceChecklist,
      server_time: syntheticEvidenceServerTime,
    });

    expect(result).toEqual({ accepted_placeholders: [placeholder], issues: [] });
  });

  it("rejects non-synthetic labels, unsupported media, unsafe sizes, and future timestamps", () => {
    const itemKey = syntheticEvidenceChecklist.items[0]!.key;
    const placeholder = {
      ...createSyntheticEvidencePlaceholder(itemKey, 1),
      display_label: "Shahbaz passport.pdf",
      media_type: "application/zip",
      size_bytes: syntheticEvidencePlaceholderSizeLimitBytes + 1,
      prepared_at: "2026-08-02T00:00:00.000Z",
    } as never;
    const result = validateSyntheticEvidenceBundle({
      bundle: createSyntheticEvidenceBundle({ placeholders: [placeholder] }),
      checklist: syntheticEvidenceChecklist,
      server_time: syntheticEvidenceServerTime,
    });

    expect(result.accepted_placeholders).toEqual([]);
    expect(result.issues.map(({ code }) => code)).toEqual([
      "invalid_display_label",
      "unsupported_media_type",
      "invalid_size",
      "prepared_in_future",
    ]);
  });

  it("rejects duplicates, unexpected items, and reused placeholder references", () => {
    const selectedKey = syntheticEvidenceChecklist.items[0]!.key;
    const first = createSyntheticEvidencePlaceholder(selectedKey, 1);
    const duplicate = {
      ...createSyntheticEvidencePlaceholder(selectedKey, 2),
      placeholder_ref: first.placeholder_ref,
    };
    const unexpected = createSyntheticEvidencePlaceholder("relationship_evidence", 3);
    const result = validateSyntheticEvidenceBundle({
      bundle: createSyntheticEvidenceBundle({
        placeholders: [first, duplicate, unexpected],
      }),
      checklist: syntheticEvidenceChecklist,
      server_time: syntheticEvidenceServerTime,
    });

    expect(result.issues.map(({ code }) => code)).toEqual([
      "duplicate_item",
      "duplicate_placeholder_ref",
      "unexpected_item",
    ]);
  });

  it("fails closed when bundle identity or policy binding is tampered", () => {
    const bundle = {
      ...createSyntheticEvidenceBundle(),
      synthetic_only: false,
      bundle_ref: "production-bundle",
      policy_version: syntheticEvidenceChecklist.policy_version! + 1,
    } as unknown as SyntheticEvidenceBundleV1;
    const result = validateSyntheticEvidenceBundle({
      bundle,
      checklist: syntheticEvidenceChecklist,
      server_time: syntheticEvidenceServerTime,
    });

    expect(result.issues.map(({ code }) => code)).toEqual([
      "invalid_bundle",
      "policy_binding_mismatch",
    ]);
  });
});
