import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { createClaimantUploadProcessorV1, ClaimantUploadProcessorError }
  from "./claimant-upload-processor.js";
import { CLAIMANT_QUARANTINE_BUCKET } from "./private-quarantine-service.js";

const ids = { case: "40000000-0000-4000-8000-000000000001",
  object: "40000000-0000-4000-8000-000000000002",
  processor: "40000000-0000-4000-8000-000000000003",
  quarantine: "40000000-0000-4000-8000-000000000004",
  scan: "40000000-0000-4000-8000-000000000005" };
const token = Buffer.alloc(32, 5).toString("base64url");
const objectPath = `v1/${ids.case}/${ids.object}`;

describe("claimant upload processor", () => {
  it("fails disabled before touching adapters", async () => {
    const dependencies = adapters();
    const processor = createClaimantUploadProcessorV1(dependencies);
    await expect(processor.upload(uploadInput())).rejects.toMatchObject({ kind: "disabled" });
    expect(dependencies.storage.put).not.toHaveBeenCalled();
  });

  it("streams bounded bytes through quarantine and clean scanning", async () => {
    const dependencies = adapters();
    const processor = createClaimantUploadProcessorV1({ ...dependencies, approved: true });
    const result = await processor.upload(uploadInput());
    expect(result).toMatchObject({ status: "clean", version: 2 });
    expect(dependencies.storage.put).toHaveBeenCalledWith(expect.objectContaining({
      bucket: CLAIMANT_QUARANTINE_BUCKET, contentType: "application/pdf", objectPath }));
    expect(dependencies.transactions.quarantine).toHaveBeenCalledWith(expect.objectContaining({
      capabilityDigest: createHash("sha256").update(token).digest("hex"),
      contentDigest: createHash("sha256").update(Buffer.from("test")).digest("hex"),
      sizeBytes: 4 }));
    expect(dependencies.transactions.scan).toHaveBeenCalledWith(expect.objectContaining({ scanResult: "clean" }));
  });

  it("removes partial bytes after an oversized or invalid stream", async () => {
    const dependencies = adapters();
    const processor = createClaimantUploadProcessorV1({ ...dependencies, approved: true });
    await expect(processor.upload(uploadInput({ body: chunks("too-long"), expectedSizeBytes: 4 })))
      .rejects.toBeInstanceOf(ClaimantUploadProcessorError);
    expect(dependencies.storage.remove).toHaveBeenCalledWith({ bucket: CLAIMANT_QUARANTINE_BUCKET,
      objectPath });
    expect(dependencies.transactions.quarantine).not.toHaveBeenCalled();
  });

  it("removes bytes when inspection fails, but reports reconciliation when cleanup fails", async () => {
    const dependencies = adapters();
    dependencies.inspector.inspect.mockResolvedValueOnce({ ...inspection(), signatureValid: false });
    await expect(createClaimantUploadProcessorV1({ ...dependencies, approved: true })
      .upload(uploadInput())).rejects.toMatchObject({ kind: "upload_failed" });

    const failedCleanup = adapters();
    failedCleanup.inspector.inspect.mockRejectedValueOnce(new Error("parser detail"));
    failedCleanup.storage.remove.mockRejectedValueOnce(new Error("storage detail"));
    await expect(createClaimantUploadProcessorV1({ ...failedCleanup, approved: true })
      .upload(uploadInput())).rejects.toMatchObject({ kind: "reconciliation_required" });
  });

  it("preserves a committed object after an ambiguous quarantine response", async () => {
    const dependencies = adapters();
    dependencies.transactions.quarantine.mockRejectedValueOnce(new Error("lost response"));
    dependencies.transactions.reconcile
      .mockResolvedValueOnce(authority("upload_pending", null, null))
      .mockResolvedValueOnce(authority("object_recorded", "quarantined", 1));
    const result = await createClaimantUploadProcessorV1({ ...dependencies, approved: true })
      .upload(uploadInput());
    expect(result).toMatchObject({ status: "clean" });
    expect(dependencies.storage.remove).not.toHaveBeenCalled();
  });

  it("deletes only server-confirmed uncommitted bytes after a failed commit", async () => {
    const dependencies = adapters();
    dependencies.transactions.quarantine.mockRejectedValueOnce(new Error("rejected"));
    dependencies.transactions.reconcile
      .mockResolvedValueOnce(authority("upload_pending", null, null))
      .mockResolvedValueOnce(authority("upload_pending", null, null));
    await expect(createClaimantUploadProcessorV1({ ...dependencies, approved: true })
      .upload(uploadInput())).rejects.toMatchObject({ kind: "upload_failed" });
    expect(dependencies.storage.remove).toHaveBeenCalledTimes(1);
  });

  it("records scanner exceptions as fail-closed scan errors", async () => {
    const dependencies = adapters();
    dependencies.scanner.scan.mockRejectedValueOnce(new Error("provider detail"));
    dependencies.transactions.scan.mockResolvedValueOnce({ caseId: ids.case, objectId: ids.object,
      replayed: false, status: "scan_failed", version: 2 });
    const result = await createClaimantUploadProcessorV1({ ...dependencies, approved: true })
      .upload(uploadInput());
    expect(result.status).toBe("scan_failed");
    expect(dependencies.transactions.scan).toHaveBeenCalledWith(expect.objectContaining({ scanResult: "error" }));
  });

  it("reconciles tracked scan failures and removes expired uncommitted orphans", async () => {
    const dependencies = adapters();
    dependencies.transactions.reconcile.mockResolvedValueOnce(authority("object_recorded", "scan_failed", 2));
    await createClaimantUploadProcessorV1({ ...dependencies, approved: true }).reconcile(reconcileInput());
    expect(dependencies.transactions.scan).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 2 }));

    dependencies.transactions.reconcile.mockResolvedValueOnce(authority("upload_uncommitted", null, null));
    dependencies.storage.exists.mockResolvedValueOnce(true);
    await expect(createClaimantUploadProcessorV1({ ...dependencies, approved: true })
      .reconcile(reconcileInput())).rejects.toMatchObject({ kind: "upload_failed" });
    expect(dependencies.storage.remove).toHaveBeenCalled();
  });
});

function adapters() {
  const storage = { exists: vi.fn().mockResolvedValue(false),
    put: vi.fn(async ({ body }) => { for await (const chunk of body) void chunk; }),
    remove: vi.fn().mockResolvedValue(undefined) };
  const inspector = { inspect: vi.fn().mockResolvedValue(inspection()) };
  const scanner = { scan: vi.fn().mockResolvedValue("clean") };
  const transactions = { reconcile: vi.fn().mockResolvedValue(authority("upload_pending", null, null)),
    issue: vi.fn(), planDeletion: vi.fn(), confirmDeleted: vi.fn(),
    abandon: vi.fn().mockResolvedValue({ caseId: ids.case, objectId: ids.object, objectPath,
      replayed: false, status: "abandoned" }),
    quarantine: vi.fn().mockResolvedValue({ caseId: ids.case, objectId: ids.object,
      replayed: false, status: "quarantined", version: 1 }),
    scan: vi.fn().mockResolvedValue({ caseId: ids.case, objectId: ids.object,
      replayed: false, status: "clean", version: 2 }) };
  return { inspector, scanner, storage, transactions };
}
function inspection() { return { archiveEntryCount: 1, detectedMediaType: "application/pdf" as const,
  expandedSizeBytes: 4, pageCount: 1, signatureValid: true }; }
async function* chunks(value: string) { yield Buffer.from(value); }
function uploadInput(changes = {}) { return { body: chunks("test"), capabilityToken: token,
  caseId: ids.case, cleanupIdempotencyKey: "40000000-0000-4000-8000-000000000006",
  deleteAfter: "2026-09-01T00:00:00.000Z",
  expectedMediaType: "application/pdf" as const, expectedSizeBytes: 4, objectId: ids.object,
  objectPath, processorUserId: ids.processor, quarantineIdempotencyKey: ids.quarantine,
  scanIdempotencyKey: ids.scan, ...changes }; }
function reconcileInput() { const { body: _body, expectedMediaType: _type,
  expectedSizeBytes: _size, ...value } = uploadInput(); return value; }
function authority(authorityValue: "upload_pending" | "upload_uncommitted" | "object_recorded",
  objectStatus: "quarantined" | "scan_failed" | null, objectVersion: number | null) {
  return { authority: authorityValue, capabilityStatus: authorityValue === "object_recorded" ? "consumed" : "issued",
    caseId: ids.case, expectedMediaType: "application/pdf" as const, expectedSizeBytes: 4,
    objectId: ids.object, objectPath, objectStatus, objectVersion };
}
