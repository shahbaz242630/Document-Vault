import { describe, expect, it, vi } from "vitest";

import {
  CLAIMANT_QUARANTINE_BUCKET,
  createPrivateQuarantineCapabilityServiceV1,
  deleteQuarantinedEvidenceV1,
  PrivateQuarantineServiceError,
  scanQuarantinedEvidenceV1,
  validateEvidenceInspectionV1,
} from "./private-quarantine-service.js";

const ids = { case: "30000000-0000-4000-8000-000000000001",
  claimant: "30000000-0000-4000-8000-000000000002",
  attempt: "30000000-0000-4000-8000-000000000003",
  session: "30000000-0000-4000-8000-000000000004",
  object: "30000000-0000-4000-8000-000000000005" };

describe("private quarantine service", () => {
  it("fails disabled before randomness or persistence", async () => {
    const issue = vi.fn();
    const service = createPrivateQuarantineCapabilityServiceV1({ capabilityDerivationKey: Buffer.alloc(32),
      transactions: { issue } as never });
    await expect(service.issue(request())).rejects.toMatchObject({ kind: "disabled" });
    expect(issue).not.toHaveBeenCalled();
  });

  it("issues an exact five-minute randomized case-bound capability", async () => {
    const issue = vi.fn(async (value) => ({ caseId: ids.case, expiresAt: value.expiresAt,
      objectId: value.objectId, objectPath: value.objectPath, replayed: false }));
    const service = createPrivateQuarantineCapabilityServiceV1({ approved: true,
      capabilityDerivationKey: Buffer.alloc(32, 7), transactions: { issue } as never });
    const result = await service.issue(request());
    expect(result).toMatchObject({ bucket: CLAIMANT_QUARANTINE_BUCKET,
      expiresAt: "2026-08-12T12:05:00.000Z",
      objectPath: expect.stringMatching(new RegExp(`^v1/${ids.case}/[0-9a-f-]{36}$`, "u")) });
    expect(result.capabilityToken).toHaveLength(43);
    expect(issue).toHaveBeenCalledWith(expect.objectContaining({
      capabilityDigest: expect.stringMatching(/^[0-9a-f]{64}$/u) }));
    expect(JSON.stringify(issue.mock.calls)).not.toContain(result.capabilityToken);
  });

  it("rejects response binding changes", async () => {
    const service = createPrivateQuarantineCapabilityServiceV1({ approved: true,
      capabilityDerivationKey: Buffer.alloc(32),
      transactions: { issue: vi.fn().mockResolvedValue({
        caseId: ids.case, expiresAt: "2026-08-12T12:05:00.000Z", objectId: ids.object,
        objectPath: "v1/changed", replayed: false }) } as never });
    await expect(service.issue(request())).rejects.toThrow("binding failed");
  });

  it("reproduces the same opaque capability binding for an idempotent retry", async () => {
    const issue = vi.fn(async (value) => ({ caseId: ids.case, expiresAt: value.expiresAt,
      objectId: value.objectId, objectPath: value.objectPath, replayed: issue.mock.calls.length > 1 }));
    const service = createPrivateQuarantineCapabilityServiceV1({ approved: true,
      capabilityDerivationKey: Buffer.alloc(32, 9),
      transactions: { issue } as never });
    const first = await service.issue(request()); const replay = await service.issue(request());
    expect(replay).toMatchObject({ capabilityToken: first.capabilityToken,
      objectId: first.objectId, objectPath: first.objectPath, replayed: true });
  });

  it("accepts only exact bounded inspection results", () => {
    const valid = { archiveEntryCount: 1, contentDigest: "a".repeat(64),
      detectedMediaType: "application/pdf" as const, expandedSizeBytes: 4096,
      pageCount: 2, signatureValid: true, sizeBytes: 1024 };
    expect(validateEvidenceInspectionV1({ mediaType: "application/pdf", sizeBytes: 1024 }, valid)).toBe(valid);
    for (const changed of [{ ...valid, signatureValid: false }, { ...valid, sizeBytes: 1025 },
      { ...valid, detectedMediaType: "image/png" as const }, { ...valid, pageCount: 51 },
      { ...valid, archiveEntryCount: 2 }, { ...valid, expandedSizeBytes: 100 * 1024 * 1024 + 1 }]) {
      expect(() => validateEvidenceInspectionV1({ mediaType: "application/pdf", sizeBytes: 1024 }, changed))
        .toThrow(PrivateQuarantineServiceError);
    }
  });

  it("fails scanner exceptions and unexpected outcomes closed", async () => {
    await expect(scanQuarantinedEvidenceV1({ objectPath: "v1/synthetic",
      scanner: { scan: vi.fn().mockRejectedValue(new Error("provider detail")) } })).resolves.toBe("error");
    await expect(scanQuarantinedEvidenceV1({ objectPath: "v1/synthetic",
      scanner: { scan: vi.fn().mockResolvedValue("unknown") } as never })).resolves.toBe("error");
    await expect(scanQuarantinedEvidenceV1({ objectPath: "v1/synthetic",
      scanner: { scan: vi.fn().mockResolvedValue("clean") } })).resolves.toBe("clean");
  });

  it("confirms deletion only after storage removal succeeds", async () => {
    const planDeletion = vi.fn().mockResolvedValue({ status: "deletion_pending", version: 3 });
    const confirmDeleted = vi.fn().mockResolvedValue({ status: "deleted", version: 4 });
    const remove = vi.fn().mockResolvedValue(undefined);
    await deleteQuarantinedEvidenceV1({ confirmIdempotencyKey: ids.attempt,
      expectedVersion: 2, objectId: ids.object, objectPath: `v1/${ids.case}/${ids.object}`,
      planIdempotencyKey: ids.session, processorUserId: ids.claimant, storage: { remove },
      transactions: { planDeletion, confirmDeleted } as never });
    expect(remove).toHaveBeenCalledWith({ bucket: CLAIMANT_QUARANTINE_BUCKET,
      objectPath: `v1/${ids.case}/${ids.object}` });
    expect(confirmDeleted).toHaveBeenCalledAfter(remove);

    remove.mockRejectedValueOnce(new Error("storage unavailable"));
    confirmDeleted.mockClear();
    await expect(deleteQuarantinedEvidenceV1({ confirmIdempotencyKey: ids.attempt,
      expectedVersion: 2, objectId: ids.object, objectPath: `v1/${ids.case}/${ids.object}`,
      planIdempotencyKey: ids.session, processorUserId: ids.claimant, storage: { remove },
      transactions: { planDeletion, confirmDeleted } as never })).rejects.toThrow("storage unavailable");
    expect(confirmDeleted).not.toHaveBeenCalled();
  });
});

function request() { return { caseId: ids.case, claimantUserId: ids.claimant,
  expectedCaseVersion: 2, expectedIntakeVersion: 2, idempotencyKey: ids.attempt,
  issuedAt: "2026-08-12T12:00:00.000Z",
  itemKey: "claimant_photo_identity" as const, placeholderRef: "synthetic_evidence_001",
  portalSessionId: ids.session, preparationVersion: 2 }; }
