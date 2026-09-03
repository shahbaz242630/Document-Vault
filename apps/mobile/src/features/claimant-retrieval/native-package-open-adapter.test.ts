import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_NATIVE_PACKAGE_OPEN_ADAPTER_APPROVED, createNativePackageOpenAdapterV1,
  NativePackageOpenAdapterError } from "./native-package-open-adapter";

describe("native package open adapter", () => {
  it("is hard-disabled and requires an explicit native binding", async () => {
    expect(CLAIMANT_NATIVE_PACKAGE_OPEN_ADAPTER_APPROVED).toBe(false);
    const native = { verifyAndOpenPackageAsync: vi.fn() };
    await expect(createNativePackageOpenAdapterV1({ native }).verifyAndOpen(input()))
      .rejects.toMatchObject({ kind: "disabled" });
    await expect(createNativePackageOpenAdapterV1({ approved: true, native: null })
      .verifyAndOpen(input())).rejects.toMatchObject({ kind: "failed" });
    expect(native.verifyAndOpenPackageAsync).not.toHaveBeenCalled();
  });

  it("maps exact ciphertext inputs and validates a value-free native result", async () => {
    const native = { verifyAndOpenPackageAsync: vi.fn().mockResolvedValue(result()) };
    await expect(createNativePackageOpenAdapterV1({ approved: true, native })
      .verifyAndOpen(input())).resolves.toEqual(result());
    expect(native.verifyAndOpenPackageAsync).toHaveBeenCalledWith({
      canonical_manifest: input().canonicalManifest, case_id: input().caseId,
      delivery_id: input().deliveryId, delivery_key: input().deliveryKey,
      delivery_payload: input().deliveryPayload,
      detached_signature: input().detachedSignature,
      expected_manifest_digest: input().expectedManifestDigest,
      expected_payload_bytes: input().expectedPayloadBytes,
      expected_payload_digest: input().expectedPayloadDigest,
      key_alias_reference: input().keyAliasReference,
      receipt_ref: input().receiptRef, release_package_id: input().releasePackageId,
      signing_key_id: input().trustedSigningKey.signingKeyId,
      signing_public_key: input().trustedSigningKey.publicKey,
      retrieval_session_id: input().retrievalSessionId });
  });

  it.each([{ ...result(), plaintext_exported: true }, { ...result(), plaintext: "secret" },
    { ...result(), status: "delivered" }, { ...result(), asset_count: 0 }])
  ("rejects hostile or malformed native output", async (value) => {
    const native = { verifyAndOpenPackageAsync: vi.fn().mockResolvedValue(value) };
    await expect(createNativePackageOpenAdapterV1({ approved: true, native })
      .verifyAndOpen(input())).rejects.toBeInstanceOf(NativePackageOpenAdapterError);
  });
});

function input() { return { canonicalManifest: "{" + "m".repeat(510) + "}", caseId: id("02"),
  deliveryId: id("03"), deliveryKey: "synthetic_package_delivery_slice_4f",
  deliveryPayload: "{" + "c".repeat(510) + "}", detachedSignature: "S".repeat(86),
  expectedManifestDigest: "a".repeat(64), expectedPayloadBytes: 512,
  expectedPayloadDigest: "b".repeat(64), keyAliasReference: `claimant-enrollment.v1.${id("01")}`,
  receiptRef: "synthetic_delivery_receipt_slice_4f", releasePackageId: id("06"),
  retrievalSessionId: id("07"),
  trustedSigningKey: { algorithm: "ed25519", publicKey: "P".repeat(43),
    signingKeyId: "claim-release-signing-synthetic-v1", status: "active", syntheticOnly: true } as const }; }
function result() { return { asset_count: 1, case_id: id("02"), delivery_id: id("03"),
  manifest_digest: "a".repeat(64), open_session_reference: `claimant-package-open.v1.${id("04")}`,
  opened_at: "2026-08-18T12:00:00.000Z", payload_digest: "b".repeat(64),
  plaintext_exported: false, recipient_key_id: id("05"), release_package_id: id("06"),
  retrieval_session_id: id("07"), status: "opened" }; }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
