import { generateKeyPairSync, sign } from "node:crypto";

import { canonicalJson, type ReleaseManifestV1 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_SIGNED_MANIFEST_APPROVED, createSignedManifestServiceV1 }
  from "./signed-manifest-service.js";

const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32)
  .toString("base64url");
describe("signed manifest service", () => {
  it("is immutable-false by default", async () => {
    expect(CLAIMANT_SIGNED_MANIFEST_APPROVED).toBe(false);
    await expect(service().finalize(request())).rejects.toMatchObject({ kind: "disabled" });
  });
  it("verifies every canonical Ed25519 manifest before persistence", async () => {
    const transactions = { finalize: vi.fn(async () => ({ ok: true })) };
    await expect(service({ approved: true, transactions }).finalize(request()))
      .resolves.toEqual({ ok: true });
    expect(transactions.finalize).toHaveBeenCalledWith(expect.objectContaining({
      manifests: [expect.objectContaining({ grantId: id("11"),
        manifestDigest: expect.stringMatching(/^[0-9a-f]{64}$/u) }),
      expect.objectContaining({ grantId: id("12") })],
      verifiedPublicKeyDigest: expect.stringMatching(/^[0-9a-f]{64}$/u) }));
  });
  it("rejects tampering, duplicate bindings, wrong key authority, and non-synthetic keys", async () => {
    const valid = request();
    const changed = structuredClone(valid);
    changed.manifests[0].signedPackage.manifest.claim_version = 7;
    for (const hostile of [changed,
      { ...valid, manifests: [valid.manifests[0], valid.manifests[0]] }])
      await expect(service({ approved: true }).finalize(hostile)).rejects.toBeInstanceOf(Error);
    for (const keyChange of [{ authorityId: id("99") }, { liveSigningAuthority: true },
      { syntheticOnly: false }, { publicKey: "A".repeat(43) }])
      await expect(service({ approved: true, keyChange }).finalize(valid))
        .rejects.toMatchObject({ kind: "verification_failed" });
  });
});

function service(options: Record<string, unknown> = {}) {
  const key = { algorithm: "ed25519", authorityId: id("06"), keyRecordId: id("07"),
    keyVersion: 1, liveSigningAuthority: false, publicKey,
    signingKeyId: "claim-release-signing-synthetic-v1", status: "active",
    syntheticOnly: true, ...(options.keyChange as object ?? {}) } as const;
  return createSignedManifestServiceV1({ approved: options.approved as boolean | undefined,
    now: () => new Date("2026-08-18T12:00:00.000Z"),
    signingKeys: { getActiveKey: vi.fn(async () => key) } as never,
    transactions: (options.transactions ?? { finalize: vi.fn() }) as never });
}
function request() { const manifests = ["11", "12"].map((suffix) => {
  const manifest = releaseManifest(suffix); const canonical = canonicalJson(manifest);
  return { grantId: id(suffix), manifestId: id(`2${suffix.slice(-1)}`), signedPackage: {
    protocol: "sanduqkin:claim:release-package:v1" as const,
    signature_algorithm: "ed25519" as const, manifest,
    manifest_signature: sign(null, Buffer.from(canonical), keys.privateKey).toString("base64url") } };
}); return { caseId: id("01"), expectedCaseVersion: 6, expectedSigningKeyVersion: 1,
  finalizationId: id("02"), idempotencyKey: id("03"), manifests, packageId: id("04"),
  releaseAuthorizationId: id("05"), signingAuthorityId: id("06"),
  signingKeyRecordId: id("07") }; }
function releaseManifest(grantSuffix: string): ReleaseManifestV1 { return {
  protocol: "sanduqkin:claim:release-package:v1", claim_id: id("01"),
  release_package_id: id("04"), owner_id: id("08"), claimant_id: id("09"),
  claim_version: 6, cancellation_version: 1, created_at: "2026-08-18T11:00:00.000Z",
  expires_at: "2026-08-21T11:00:00.000Z",
  asset_snapshot_boundary: "2026-08-18T10:59:00.000Z",
  asset_ciphertext_digests: ["A".repeat(43)], policy_decision_version: 1,
  signing_key_id: "claim-release-signing-synthetic-v1", release_material: {
    profile: "registered_recipient_v1", grant_id: id(grantSuffix), grant_version: 1,
    recipient_id: id("09"), recipient_key_id: id(grantSuffix === "11" ? "31" : "32"),
    recipient_key_version: 1, sealed_grant_digest: "B".repeat(43) } }; }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
