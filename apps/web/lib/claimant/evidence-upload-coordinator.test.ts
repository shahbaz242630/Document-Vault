import { createSyntheticEvidencePlaceholder, syntheticEvidenceChecklist } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_EVIDENCE_UPLOAD_COORDINATOR_APPROVED,
  createEvidenceUploadCoordinatorV1, EvidenceUploadCoordinatorError,
  EvidenceUploadTransportError } from "./evidence-upload-coordinator";

const ids = { case: "40000000-0000-4000-8000-000000000001",
  object: "40000000-0000-4000-8000-000000000002" };
const token = "B" + "Q".repeat(42);
const placeholder = createSyntheticEvidencePlaceholder(syntheticEvidenceChecklist.items[0]!.key, 1);
const body = new Uint8Array(placeholder.size_bytes).fill(7);

describe("claimant evidence upload coordinator", () => {
  it("is immutable-false and touches no transport while disabled", async () => {
    expect(CLAIMANT_EVIDENCE_UPLOAD_COORDINATOR_APPROVED).toBe(false);
    const deps = dependencies();
    await expect(createEvidenceUploadCoordinatorV1(deps).upload(uploadInput()))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(deps.transport.issueCapability).not.toHaveBeenCalled();
  });

  it("binds prepared metadata through capability, upload, and bounded progress", async () => {
    const deps = dependencies(); const events: unknown[] = [];
    const coordinator = createEvidenceUploadCoordinatorV1({ ...deps, approved: true,
      onProgress: (event) => events.push(event) });
    await expect(coordinator.upload(uploadInput())).resolves.toEqual(terminal());
    expect(deps.transport.issueCapability).toHaveBeenCalledWith(expect.objectContaining({
      caseId: ids.case, expectedCaseVersion: 2, expectedIntakeVersion: 3,
      itemKey: placeholder.checklist_item_key, placeholderRef: placeholder.placeholder_ref,
      preparationVersion: 3 }));
    expect(deps.transport.upload).toHaveBeenCalledWith(expect.objectContaining({ body,
      capability: token, caseId: ids.case, contentType: placeholder.media_type,
      objectId: ids.object }));
    expect(events).toEqual([
      { phase: "capability", sentBytes: 0, totalBytes: body.byteLength },
      { phase: "uploading", sentBytes: 512, totalBytes: body.byteLength },
      { phase: "uploading", sentBytes: body.byteLength, totalBytes: body.byteLength },
      { phase: "complete", sentBytes: body.byteLength, totalBytes: body.byteLength },
    ]);
    expect(coordinator.hasPendingReconciliation()).toBe(false);
  });

  it("rejects body, version, path, and progress mismatches without false success", async () => {
    const wrongBody = dependencies();
    await expect(createEvidenceUploadCoordinatorV1({ ...wrongBody, approved: true })
      .upload(uploadInput({ body: body.subarray(1) }))).rejects.toMatchObject({ kind: "invalid_input" });
    expect(wrongBody.transport.issueCapability).not.toHaveBeenCalled();

    const wrongVersion = dependencies();
    await expect(createEvidenceUploadCoordinatorV1({ ...wrongVersion, approved: true })
      .upload(uploadInput({ preparationVersion: 4 }))).rejects.toMatchObject({ kind: "invalid_input" });
    expect(wrongVersion.transport.issueCapability).not.toHaveBeenCalled();

    const wrongPath = dependencies();
    wrongPath.transport.issueCapability.mockResolvedValueOnce({ ...capabilityResult(), objectPath: "v1/changed" });
    await expect(createEvidenceUploadCoordinatorV1({ ...wrongPath, approved: true })
      .upload(uploadInput())).rejects.toMatchObject({ kind: "failed" });
    expect(wrongPath.transport.upload).not.toHaveBeenCalled();

    const expired = dependencies();
    expired.transport.issueCapability.mockResolvedValueOnce({ ...capabilityResult(),
      expiresAt: "2026-08-12T11:59:59.000Z" });
    await expect(createEvidenceUploadCoordinatorV1({ ...expired, approved: true })
      .upload(uploadInput())).rejects.toMatchObject({ kind: "failed" });
    expect(expired.transport.upload).not.toHaveBeenCalled();

    const wrongProgress = dependencies();
    wrongProgress.transport.upload.mockImplementationOnce(async ({ onProgress }) => {
      onProgress(body.byteLength + 1); return terminal();
    });
    await expect(createEvidenceUploadCoordinatorV1({ ...wrongProgress, approved: true })
      .upload(uploadInput())).rejects.toMatchObject({ kind: "reconciliation_required" });
    expect(wrongProgress.transport.reconcile).toHaveBeenCalledOnce();
  });

  it("reconciles ambiguous upload completion before returning success", async () => {
    const deps = dependencies();
    deps.transport.upload.mockRejectedValueOnce(new EvidenceUploadTransportError("unavailable"));
    deps.transport.reconcile.mockResolvedValueOnce(terminal());
    await expect(createEvidenceUploadCoordinatorV1({ ...deps, approved: true })
      .upload(uploadInput())).resolves.toEqual(terminal());
    expect(deps.transport.reconcile).toHaveBeenCalledWith(expect.objectContaining({
      capability: token, caseId: ids.case, objectId: ids.object }));
  });

  it("keeps only an in-memory pending capability for bounded retry", async () => {
    const deps = dependencies();
    deps.transport.upload.mockRejectedValueOnce(new EvidenceUploadTransportError("conflict"));
    deps.transport.reconcile.mockResolvedValueOnce({ status: "upload_pending" });
    const coordinator = createEvidenceUploadCoordinatorV1({ ...deps, approved: true });
    await expect(coordinator.upload(uploadInput())).rejects.toMatchObject({ kind: "reconciliation_required" });
    expect(coordinator.hasPendingReconciliation()).toBe(true);
    await expect(coordinator.upload(uploadInput())).rejects.toMatchObject({ kind: "reconciliation_required" });
    expect(deps.transport.issueCapability).toHaveBeenCalledOnce();
    deps.transport.reconcile.mockResolvedValueOnce(terminal());
    await expect(coordinator.retryReconciliation()).resolves.toEqual({ status: "completed", result: terminal() });
    expect(coordinator.hasPendingReconciliation()).toBe(false);
  });

  it("fails cancellation and overlapping work closed with generic errors", async () => {
    const aborted = dependencies(); const controller = new AbortController(); controller.abort();
    await expect(createEvidenceUploadCoordinatorV1({ ...aborted, approved: true })
      .upload(uploadInput(), controller.signal)).rejects.toMatchObject({ kind: "aborted" });
    expect(aborted.transport.issueCapability).not.toHaveBeenCalled();

    const busy = dependencies(); let release!: () => void;
    busy.transport.issueCapability.mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve(capabilityResult());
    }));
    const coordinator = createEvidenceUploadCoordinatorV1({ ...busy, approved: true });
    const first = coordinator.upload(uploadInput());
    await vi.waitFor(() => expect(busy.transport.issueCapability).toHaveBeenCalled());
    await expect(coordinator.upload(uploadInput())).rejects.toMatchObject({ kind: "busy" });
    release(); await first;
  });

  it("never forwards provider detail through its public error", async () => {
    const deps = dependencies();
    deps.transport.issueCapability.mockRejectedValueOnce(new Error("provider topology and token"));
    const error = await createEvidenceUploadCoordinatorV1({ ...deps, approved: true })
      .upload(uploadInput()).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(EvidenceUploadCoordinatorError);
    expect(String(error)).not.toContain("provider topology");
  });
});

function dependencies() {
  let sequence = 3;
  const transport = {
    issueCapability: vi.fn().mockResolvedValue(capabilityResult()),
    reconcile: vi.fn().mockResolvedValue({ status: "upload_pending" }),
    upload: vi.fn(async ({ onProgress }) => { onProgress(512); onProgress(body.byteLength); return terminal(); }),
  };
  return { createIdempotencyKey: () => `40000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
    now: () => new Date("2026-08-12T12:00:00.000Z"),
    transport };
}
function capabilityResult() { return { capability: token, expiresAt: "2026-08-12T12:05:00.000Z",
  objectId: ids.object, objectPath: `v1/${ids.case}/${ids.object}` }; }
function terminal() { return { objectId: ids.object, status: "clean" as const, version: 2 }; }
function uploadInput(changes = {}) { return { body, caseId: ids.case, expectedCaseVersion: 2,
  expectedIntakeVersion: 3, placeholder, preparationVersion: 3, ...changes }; }
