import { describe, expect, it, vi } from "vitest";

import { createSignedManifestTransactionClientV1 }
  from "./signed-manifest-transaction-client.js";

describe("signed manifest transaction client", () => {
  it("maps verified manifests and accepts only release-ready non-retrievable results", async () => {
    const rpc = vi.fn(async () => ({ data: result(), error: null }));
    await expect(createSignedManifestTransactionClientV1(rpc).finalize(input()))
      .resolves.toMatchObject({ caseState: "release_ready", manifestSigned: true,
        retrievalAuthorized: false });
    expect(rpc).toHaveBeenCalledWith("claimant_finalize_signed_release_package",
      expect.objectContaining({ p_expected_signing_key_version: 1,
        p_verified_public_key_digest: "b".repeat(64),
        p_manifests: [expect.objectContaining({ grant_id: id("11"),
          signature_verified_at: "2026-08-18T12:00:00.000Z" }),
        expect.objectContaining({ grant_id: id("12") })] }));
  });
  it("rejects database errors and unsafe, extra, or incoherent results", async () => {
    const client = (data: unknown, error: { code?: string } | null = null) =>
      createSignedManifestTransactionClientV1(async () => ({ data, error }));
    await expect(client(null, { code: "40001" }).finalize(input())).rejects.toMatchObject({
      code: "40001" });
    for (const hostile of [{ ...result(), retrieval_authorized: true },
      { ...result(), manifest_signed: false }, { ...result(), case_state: "approved" },
      { ...result(), case_version: 6 }, { ...result(), private_key: "forbidden" }])
      await expect(client(hostile).finalize(input())).rejects.toThrow(/invalid result/u);
  });
});

function input() { return { caseId: id("01"), expectedCaseVersion: 6,
  expectedSigningKeyVersion: 1, finalizationId: id("02"), idempotencyKey: id("03"),
  manifests: ["11", "12"].map((suffix, index) => ({ canonicalManifest: `{${index}}`,
    detachedSignature: "S".repeat(86), grantId: id(suffix),
    manifestDigest: "a".repeat(64), manifestId: id(`2${index}`),
    signatureVerifiedAt: "2026-08-18T12:00:00.000Z" })), packageId: id("04"),
  releaseAuthorizationId: id("05"), signingAuthorityId: id("06"),
  signingKeyRecordId: id("07"), verifiedPublicKeyDigest: "b".repeat(64) }; }
function result() { return { case_id: id("01"), case_state: "release_ready",
  case_version: 7, finalization_id: id("02"),
  finalization_status: "finalized_release_ready", manifest_count: 2,
  manifest_signed: true, release_package_id: id("04"), replayed: false,
  retrieval_authorized: false }; }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
