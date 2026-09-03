import { createHash } from "node:crypto";

import { canonicalJson, type ReleaseManifestV1 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_NATIVE_PACKAGE_OPEN_APPROVED, createNativePackageOpenCoordinatorV1,
  NativePackageOpenError } from "./native-package-open-coordinator";

const ids = { case: id("01"), delivery: id("02"), finalization: id("03"), grant: id("04"),
  key: id("05"), owner: id("06"), package: id("07"), claimant: id("08"),
  retrieval: id("09"), asset: id("10") };
const openedAt = "2026-08-18T12:01:00.000Z";

describe("native encrypted-package open coordinator", () => {
  it("is immutable-false by default", async () => {
    expect(CLAIMANT_NATIVE_PACKAGE_OPEN_APPROVED).toBe(false);
    const dependencies = createDependencies();
    await expect(createNativePackageOpenCoordinatorV1(dependencies).open(request()))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(dependencies.native.verifyAndOpen).not.toHaveBeenCalled();
  });

  it("cross-binds the served package and returns only a local open reference", async () => {
    const dependencies = createDependencies();
    const result = await createNativePackageOpenCoordinatorV1({ ...dependencies, approved: true,
      now: () => new Date("2026-08-18T12:00:00.000Z") }).open(request());
    expect(result).toEqual({ assetCount: 1, caseId: ids.case, deliveryId: ids.delivery,
      expiresAt: "2026-08-21T11:00:00.000Z",
      openSessionReference: `claimant-package-open.v1.${id("20")}`, openedAt,
      plaintextExported: false, releasePackageId: ids.package,
      retrievalCompleted: false, status: "opened" });
    expect(dependencies.native.verifyAndOpen).toHaveBeenCalledWith(expect.objectContaining({
      expectedPayloadDigest: request().payloadDigest, keyAliasReference: `claimant-enrollment.v1.${id("30")}`,
      trustedSigningKey: expect.objectContaining({ signingKeyId: "claim-release-signing-synthetic-v1" }) }));
  });

  it.each([
    ["unserved", { deliveryStatus: "prepared_unserved" }],
    ["completed", { retrievalCompleted: true }],
    ["wrong case version", { releasedCaseVersion: 9 }],
    ["wrong recipient key", { recipientKeyId: id("99") }],
  ])("rejects %s input before native opening", async (_name, changed) => {
    const dependencies = createDependencies();
    await expect(createNativePackageOpenCoordinatorV1({ ...dependencies, approved: true }).open({
      ...request(), ...changed })).rejects.toBeInstanceOf(NativePackageOpenError);
    expect(dependencies.native.verifyAndOpen).not.toHaveBeenCalled();
  });

  it("rejects manifest, expiry, signing-key, and native-output substitution", async () => {
    const changedPayload = payload(); changedPayload.case_id = id("99");
    const cases = [
      { value: { ...request(), deliveryPayload: JSON.stringify(changedPayload) } },
      { now: () => new Date("2026-08-22T00:00:00.000Z"), value: request() },
      { key: { ...trustedKey(), signingKeyId: "claim-release-signing-synthetic-other" }, value: request() },
      { opened: { ...opened(), payload_digest: "0".repeat(64) }, value: request() },
    ];
    for (const item of cases) {
      const dependencies = createDependencies(item.key, item.opened);
      await expect(createNativePackageOpenCoordinatorV1({ ...dependencies, approved: true,
        now: item.now ?? (() => new Date("2026-08-18T12:00:00.000Z")) }).open(item.value))
        .rejects.toMatchObject({ kind: expect.stringMatching(/invalid_input|verification_failed/u) });
    }
  });

  it("serializes opening and honors cancellation without exposing native errors", async () => {
    let release!: () => void;
    const dependencies = createDependencies();
    dependencies.native.verifyAndOpen.mockImplementation(() => new Promise((resolve) => {
      release = () => resolve(opened());
    }));
    const coordinator = createNativePackageOpenCoordinatorV1({ ...dependencies, approved: true,
      now: () => new Date("2026-08-18T12:00:00.000Z") });
    const first = coordinator.open(request());
    await expect(coordinator.open(request())).rejects.toMatchObject({ kind: "verification_failed" });
    release(); await expect(first).resolves.toMatchObject({ status: "opened" });
    const controller = new AbortController(); controller.abort();
    await expect(coordinator.open(request(), controller.signal)).rejects.toMatchObject({ kind: "aborted" });
  });
});

function createDependencies(key: unknown = trustedKey(), nativeOpened: unknown = opened()) {
  return { native: { verifyAndOpen: vi.fn().mockResolvedValue(nativeOpened) },
    signingKeys: { resolve: vi.fn().mockResolvedValue(key) } };
}
function request() { const deliveryPayload = JSON.stringify(payload()); return {
  authorizedCaseVersion: 7, caseId: ids.case, deliveryId: ids.delivery,
  deliveryKey: "synthetic_package_delivery_slice_4f", deliveryPayload, deliveryStatus: "served",
  keyAliasReference: `claimant-enrollment.v1.${id("30")}`, packageServed: true,
  payloadBytes: Buffer.byteLength(deliveryPayload), payloadDigest: sha(deliveryPayload),
  receiptRef: "synthetic_delivery_receipt_slice_4f", recipientKeyId: ids.key,
  releasePackageId: ids.package, releasedCaseVersion: 8, retrievalCompleted: false,
  retrievalSessionId: ids.retrieval, servedAt: "2026-08-18T12:00:00.000Z" } as const; }
function payload() { const canonical = canonicalJson(manifest() as never); return {
  assets: [{ asset_type: "document", ciphertext: "V".repeat(64),
    ciphertext_digest: "a".repeat(64), nonce: "N".repeat(24), ordinal: 1,
    source_asset_id: ids.asset }], case_id: ids.case, finalization_id: ids.finalization,
  protocol: "sanduqkin:claim:encrypted-delivery:v1", release_material: {
    aead: "xchacha20poly1305_ietf", ciphertext: "C".repeat(96), grant_id: ids.grant,
    grant_version: 1, kdf: "hkdf_sha256", key_agreement: "p256_ecdh", nonce: "G".repeat(24),
    owner_ephemeral_public_key: "E".repeat(43), profile: "registered_recipient_v2",
    protocol: "sanduqkin:claim:recipient-grant:v2", recipient_key_id: ids.key,
    recipient_key_version: 1 }, release_package_id: ids.package,
  retrieval_session_id: ids.retrieval, signed_manifest: { canonical_manifest: canonical,
    detached_signature: "S".repeat(86), manifest_digest: sha(canonical),
    signature_algorithm: "ed25519" } }; }
function manifest(): ReleaseManifestV1 { return { asset_ciphertext_digests: [
  Buffer.from("a".repeat(64), "hex").toString("base64url")],
  asset_snapshot_boundary: "2026-08-18T10:59:00.000Z", cancellation_version: 1,
  claim_id: ids.case, claim_version: 6, claimant_id: ids.claimant,
  created_at: "2026-08-18T11:00:00.000Z", expires_at: "2026-08-21T11:00:00.000Z",
  owner_id: ids.owner, policy_decision_version: 1,
  protocol: "sanduqkin:claim:release-package:v1", release_package_id: ids.package,
  release_material: { grant_id: ids.grant, grant_version: 1, profile: "registered_recipient_v1",
    recipient_id: ids.claimant, recipient_key_id: ids.key, recipient_key_version: 1,
    sealed_grant_digest: "B".repeat(43) }, signing_key_id: "claim-release-signing-synthetic-v1" }; }
function trustedKey() { return { algorithm: "ed25519", publicKey: "P".repeat(43),
  signingKeyId: "claim-release-signing-synthetic-v1", status: "active", syntheticOnly: true } as const; }
function opened() { return { asset_count: 1, case_id: ids.case, delivery_id: ids.delivery,
  manifest_digest: payload().signed_manifest.manifest_digest,
  open_session_reference: `claimant-package-open.v1.${id("20")}`, opened_at: openedAt,
  payload_digest: request().payloadDigest, plaintext_exported: false, recipient_key_id: ids.key,
  release_package_id: ids.package, retrieval_session_id: ids.retrieval, status: "opened" }; }
function sha(value: string) { return createHash("sha256").update(value).digest("hex"); }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
