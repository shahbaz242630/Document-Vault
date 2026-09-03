import {
  createSyntheticEvidenceBundle,
  createSyntheticEvidencePlaceholder,
  syntheticEvidenceChecklist,
} from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import {
  createEvidencePreparationServiceV1,
  EvidencePreparationServiceError,
} from "./claim-evidence-preparation-service.js";

const context = {
  caseId: "20000000-0000-4000-8000-000000000001",
  claimantUserId: "20000000-0000-4000-8000-000000000002",
  expectedCaseVersion: 2,
  expectedIntakeVersion: 1,
  idempotencyKey: "20000000-0000-4000-8000-000000000003",
  portalSessionId: "20000000-0000-4000-8000-000000000004",
};

describe("claim evidence preparation service", () => {
  it("fails disabled before reading time or touching persistence", async () => {
    const serverTime = vi.fn();
    const record = vi.fn();
    const service = createEvidencePreparationServiceV1({ serverTime, transactions: { record } });
    await expect(service.record({ ...context, bundle: {} })).rejects.toMatchObject({ kind: "disabled" });
    expect(serverTime).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("strips display metadata and records only bounded preparation fields", async () => {
    const record = vi.fn().mockResolvedValue({ status: "documents_needed" });
    const item = syntheticEvidenceChecklist.items[0]!.key;
    const bundle = { ...createSyntheticEvidenceBundle({
      placeholders: [createSyntheticEvidencePlaceholder(item, 1)],
    }), bundle_ref: "synthetic_bundle_alpha_002" };
    const service = createEvidencePreparationServiceV1({ approved: true,
      serverTime: () => "2026-08-12T12:00:00.000Z", transactions: { record } as never });
    await service.record({ ...context, bundle });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      bundleRef: "synthetic_bundle_alpha_002",
      preparedItems: [expect.objectContaining({ itemKey: item, placeholderRef: "synthetic_evidence_001" })],
      unavailableItems: [],
    }));
    expect(JSON.stringify(record.mock.calls)).not.toContain("display_label");
  });

  it("rejects duplicate and overlapping checklist declarations", async () => {
    const item = syntheticEvidenceChecklist.items[0]!.key;
    const bundle = createSyntheticEvidenceBundle({
      placeholders: [createSyntheticEvidencePlaceholder(item, 1)], unavailable_items: [item],
    });
    const service = createEvidencePreparationServiceV1({ approved: true,
      serverTime: () => "2026-08-12T12:00:00.000Z", transactions: { record: vi.fn() } });
    await expect(service.record({ ...context, bundle })).rejects.toBeInstanceOf(EvidencePreparationServiceError);

    const secondItem = syntheticEvidenceChecklist.items[1]!.key;
    const duplicateRefBundle = createSyntheticEvidenceBundle({ placeholders: [
      createSyntheticEvidencePlaceholder(item, 1),
      { ...createSyntheticEvidencePlaceholder(secondItem, 2), placeholder_ref: "synthetic_evidence_001" },
    ] });
    await expect(service.record({ ...context, bundle: duplicateRefBundle }))
      .rejects.toMatchObject({ kind: "invalid_bundle" });
  });

  it("rejects unsafe labels, future timestamps, extra fields, and empty bundles", async () => {
    const item = syntheticEvidenceChecklist.items[0]!.key;
    const valid = createSyntheticEvidencePlaceholder(item, 1);
    const service = createEvidencePreparationServiceV1({ approved: true,
      serverTime: () => "2026-08-12T12:00:00.000Z", transactions: { record: vi.fn() } });
    const variants = [
      createSyntheticEvidenceBundle({ placeholders: [{ ...valid, display_label: "person-passport.pdf" }] }),
      createSyntheticEvidenceBundle({ placeholders: [{ ...valid, prepared_at: "2026-08-13T12:00:00.000Z" }] }),
      { ...createSyntheticEvidenceBundle({ placeholders: [valid] }), filename: "unsafe.pdf" },
      createSyntheticEvidenceBundle(),
    ];
    for (const bundle of variants) {
      await expect(service.record({ ...context, bundle })).rejects.toMatchObject({ kind: "invalid_bundle" });
    }
  });
});
