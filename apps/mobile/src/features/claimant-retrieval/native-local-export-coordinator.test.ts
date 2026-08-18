import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_NATIVE_LOCAL_EXPORT_APPROVED, createNativeLocalExportCoordinatorV1,
  NativeLocalExportError } from "./native-local-export-coordinator";

const uuid = (suffix: string) => `30000000-0000-4000-8000-0000000000${suffix}`;
const now = new Date("2026-08-18T15:00:00.000Z");

describe("native local export coordinator", () => {
  it("is immutable-false before native work", async () => {
    const native = { exportLocalCopy: vi.fn() };
    expect(CLAIMANT_NATIVE_LOCAL_EXPORT_APPROVED).toBe(false);
    await expect(createNativeLocalExportCoordinatorV1({ native }).exportLocalCopy(request()))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(native.exportLocalCopy).not.toHaveBeenCalled();
  });

  it("returns only a value-free local export receipt", async () => {
    const native = { exportLocalCopy: vi.fn().mockResolvedValue(nativeResult()) };
    const result = await createNativeLocalExportCoordinatorV1({ approved: true, native,
      now: () => now }).exportLocalCopy(request());
    expect(result).toEqual({ assetCount: 2, caseId: uuid("01"), completionId: uuid("02"),
      closureRecorded: false, deliveryId: uuid("03"),
      destinationClass: "user_selected_local_copy",
      exportReceiptReference: `claimant-local-export.v1.${uuid("09")}`,
      exportedAt: "2026-08-18T15:00:02.000Z", localCopyCreated: true,
      plaintextReturnedToJavaScript: false, releasePackageId: uuid("04"),
      retrievalSessionId: uuid("05"), serverUploadPerformed: false, status: "exported" });
    expect(native.exportLocalCopy).toHaveBeenCalledWith(expect.objectContaining({
      openSessionReference: `claimant-package-open.v1.${uuid("06")}`,
      interactionId: uuid("07") }));
  });

  it("requires exact completed active unexported authority and explicit intent", async () => {
    const coordinator = createNativeLocalExportCoordinatorV1({ approved: true,
      native: { exportLocalCopy: vi.fn() }, now: () => now });
    for (const changed of [{ retrievalCompleted: false }, { retrievalAccessState: "suspended" },
      { finalizationStatus: "expired" }, { packageServed: false }, { exportPerformed: true },
      { closureRecorded: true }, { exportIntent: "background_export" }, { unexpected: true }])
      await expect(coordinator.exportLocalCopy({ ...request(), ...changed }))
        .rejects.toMatchObject({ kind: "invalid_input" });
  });

  it("requires a fresh request before package expiry", async () => {
    const coordinator = createNativeLocalExportCoordinatorV1({ approved: true,
      native: { exportLocalCopy: vi.fn() }, now: () => now });
    for (const changed of [{ requestedAt: "2026-08-18T14:57:59.000Z" },
      { requestedAt: "2026-08-18T15:01:01.000Z" },
      { expiresAt: "2026-08-18T15:00:00.000Z" },
      { completedAt: "2026-08-18T15:00:30.000Z" }])
      await expect(coordinator.exportLocalCopy({ ...request(), ...changed }))
        .rejects.toBeInstanceOf(NativeLocalExportError);
  });

  it("rejects substituted, unsafe or stale native receipts", async () => {
    for (const changed of [{ case_id: uuid("08") }, { asset_count: 3 },
      { explicit_confirmation_verified: false }, { user_presence_verified: false },
      { plaintext_returned_to_javascript: true }, { server_upload_performed: true },
      { closure_recorded: true }, { authenticated_at: "2026-08-18T14:57:00.000Z" },
      { exported_at: "2026-08-18T16:00:00.000Z" }, { file_path: "/private/export" }]) {
      const coordinator = createNativeLocalExportCoordinatorV1({ approved: true,
        native: { exportLocalCopy: vi.fn().mockResolvedValue({ ...nativeResult(), ...changed }) },
        now: () => now });
      await expect(coordinator.exportLocalCopy(request())).rejects
        .toMatchObject({ kind: "export_failed" });
    }
  });

  it("serializes export and honors cancellation", async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise((done) => { resolve = done; });
    const coordinator = createNativeLocalExportCoordinatorV1({ approved: true,
      native: { exportLocalCopy: vi.fn().mockReturnValue(pending) }, now: () => now });
    const first = coordinator.exportLocalCopy(request());
    await expect(coordinator.exportLocalCopy(request())).rejects
      .toMatchObject({ kind: "export_failed" });
    resolve(nativeResult()); await expect(first).resolves.toBeDefined();
    const aborted = new AbortController(); aborted.abort();
    await expect(coordinator.exportLocalCopy(request(), aborted.signal)).rejects
      .toMatchObject({ kind: "aborted" });
  });
});

function request() {
  return { assetCount: 2, caseId: uuid("01"), closureRecorded: false,
    completedAt: "2026-08-18T14:59:31.000Z", completionId: uuid("02"),
    deliveryId: uuid("03"), expiresAt: "2026-08-18T16:00:00.000Z",
    exportIntent: "claimant_explicit_local_copy", exportPerformed: false,
    finalizationStatus: "finalized_release_ready", interactionId: uuid("07"),
    openSessionReference: `claimant-package-open.v1.${uuid("06")}`,
    openedAt: "2026-08-18T14:59:30.000Z", packageServed: true,
    releasePackageId: uuid("04"), requestedAt: "2026-08-18T14:59:59.000Z",
    retrievalAccessState: "active", retrievalCompleted: true,
    retrievalSessionId: uuid("05") };
}
function nativeResult() {
  return { asset_count: 2, authenticated_at: "2026-08-18T15:00:01.000Z",
    case_id: uuid("01"), closure_recorded: false, completion_id: uuid("02"),
    delivery_id: uuid("03"), destination_class: "user_selected_local_copy",
    explicit_confirmation_verified: true,
    export_receipt_reference: `claimant-local-export.v1.${uuid("09")}`,
    exported_at: "2026-08-18T15:00:02.000Z", interaction_id: uuid("07"),
    local_copy_created: true, open_session_reference: `claimant-package-open.v1.${uuid("06")}`,
    plaintext_returned_to_javascript: false, release_package_id: uuid("04"),
    retrieval_session_id: uuid("05"), server_upload_performed: false,
    status: "exported", user_presence_verified: true };
}
