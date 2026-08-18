import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_NATIVE_LOCAL_EXPORT_ADAPTER_APPROVED, createNativeLocalExportAdapterV1,
  NativeLocalExportAdapterError } from "./native-local-export-adapter";

const id = (suffix: string) => `40000000-0000-4000-8000-0000000000${suffix}`;

describe("native local export adapter", () => {
  it("is disabled by default and rejects a missing native binding", async () => {
    const native = { exportOpenedPackageAsync: vi.fn() };
    expect(CLAIMANT_NATIVE_LOCAL_EXPORT_ADAPTER_APPROVED).toBe(false);
    await expect(createNativeLocalExportAdapterV1({ native }).exportLocalCopy(input()))
      .rejects.toMatchObject({ kind: "disabled" });
    await expect(createNativeLocalExportAdapterV1({ approved: true, native: null })
      .exportLocalCopy(input())).rejects.toMatchObject({ kind: "failed" });
    expect(native.exportOpenedPackageAsync).not.toHaveBeenCalled();
  });

  it("requires native confirmation and fresh user presence", async () => {
    const native = { exportOpenedPackageAsync: vi.fn().mockResolvedValue(result()) };
    await expect(createNativeLocalExportAdapterV1({ approved: true, native })
      .exportLocalCopy(input())).resolves.toEqual(result());
    expect(native.exportOpenedPackageAsync).toHaveBeenCalledWith(expect.objectContaining({
      require_explicit_confirmation: true, require_fresh_user_presence: true,
      open_session_reference: `claimant-package-open.v1.${id("06")}` }));
  });

  it("rejects native output containing private or unsafe fields", async () => {
    for (const changed of [{ plaintext: "secret" }, { file_path: "/tmp/export" },
      { plaintext_returned_to_javascript: true }, { closure_recorded: true }])
      await expect(createNativeLocalExportAdapterV1({ approved: true,
        native: { exportOpenedPackageAsync: vi.fn().mockResolvedValue({ ...result(), ...changed }) } })
        .exportLocalCopy(input())).rejects.toBeInstanceOf(NativeLocalExportAdapterError);
  });
});

function input() {
  return { assetCount: 2, caseId: id("01"), completionId: id("02"), deliveryId: id("03"),
    expiresAt: "2026-08-18T16:00:00.000Z", interactionId: id("07"),
    openSessionReference: `claimant-package-open.v1.${id("06")}`,
    releasePackageId: id("04"), requestedAt: "2026-08-18T14:59:59.000Z",
    retrievalSessionId: id("05") };
}
function result() {
  return { asset_count: 2, authenticated_at: "2026-08-18T15:00:01.000Z",
    case_id: id("01"), closure_recorded: false, completion_id: id("02"),
    delivery_id: id("03"), destination_class: "user_selected_local_copy",
    explicit_confirmation_verified: true,
    export_receipt_reference: `claimant-local-export.v1.${id("09")}`,
    exported_at: "2026-08-18T15:00:02.000Z", interaction_id: id("07"),
    local_copy_created: true, open_session_reference: `claimant-package-open.v1.${id("06")}`,
    plaintext_returned_to_javascript: false, release_package_id: id("04"),
    retrieval_session_id: id("05"), server_upload_performed: false,
    status: "exported", user_presence_verified: true };
}
