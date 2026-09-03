import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_RETRIEVAL_COMPLETION_APPROVED, createRetrievalCompletionServiceV1,
  RetrievalCompletionServiceError } from "./retrieval-completion-service";

describe("retrieval completion service", () => {
  it("is immutable-false and performs no proof or database work by default", async () => {
    expect(CLAIMANT_RETRIEVAL_COMPLETION_APPROVED).toBe(false);
    const dependencies = deps();
    await expect(createRetrievalCompletionServiceV1(dependencies).complete(request()))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(dependencies.proofVerifier.verify).not.toHaveBeenCalled();
    expect(dependencies.transactions.complete).not.toHaveBeenCalled();
  });

  it("commits an exact verified device-open proof without export or closure", async () => {
    const dependencies = deps();
    await expect(createRetrievalCompletionServiceV1({ ...dependencies, approved: true })
      .complete(request())).resolves.toMatchObject({ retrievalCompleted: true,
        exportPerformed: false, closureRecorded: false });
    expect(dependencies.proofVerifier.verify).toHaveBeenCalledWith({ expected: expect.objectContaining({
      deliveryId: request().deliveryId, exportPerformed: false,
      nativeOpenSessionReference: request().nativeOpenSessionReference,
      protocol: "sanduqkin:claim:native-open-proof:v1" }), proof: request().proof });
    const expectedSessionDigest = sha(request().nativeOpenSessionReference);
    const proof = verifiedProof();
    const expectedProofDigest = sha([proof.protocol, proof.completionId, proof.deliveryId,
      proof.deliveryKey, proof.retrievalSessionId, proof.caseId, proof.releasePackageId,
      proof.portalSessionId, proof.claimantKeyId, proof.appAttestKeyIdDigest,
      String(proof.expectedPreviousCounter), String(proof.verifiedCounter), proof.bundleVersion,
      String(proof.validationCategory), proof.payloadDigest, proof.manifestDigest,
      expectedSessionDigest, proof.openedAt, "false"].join("|"));
    expect(dependencies.transactions.complete).toHaveBeenCalledWith(expect.objectContaining({
      nativeOpenSessionDigest: expectedSessionDigest, verifiedProofDigest: expectedProofDigest,
      expectedPreviousCounter: 4, verifiedCounter: 5 }));
  });

  it.each([null, {}, { ...request(), openedAt: "2026-08-18T12:00:00Z" },
    { ...request(), deliveryKey: "live_delivery" }, { ...request(), extra: true }])
  ("rejects malformed input before proof verification", async (value) => {
    const dependencies = deps();
    await expect(createRetrievalCompletionServiceV1({ ...dependencies, approved: true })
      .complete(value)).rejects.toBeInstanceOf(RetrievalCompletionServiceError);
    expect(dependencies.proofVerifier.verify).not.toHaveBeenCalled();
  });

  it("rejects counter, export, binding, and verifier substitution before persistence", async () => {
    for (const proof of [{ ...verifiedProof(), verifiedCounter: 4 },
      { ...verifiedProof(), exportPerformed: true },
      { ...verifiedProof(), deliveryId: id("99") },
      { ...verifiedProof(), syntheticOnly: false }, { ...verifiedProof(), plaintext: "secret" }]) {
      const dependencies = deps(proof);
      await expect(createRetrievalCompletionServiceV1({ ...dependencies, approved: true })
        .complete(request())).rejects.toMatchObject({ kind: "verification_failed" });
      expect(dependencies.transactions.complete).not.toHaveBeenCalled();
    }
  });

  it("redacts verifier and transaction failures", async () => {
    const verifierFailure = deps(); verifierFailure.proofVerifier.verify.mockRejectedValue(new Error("secret"));
    await expect(createRetrievalCompletionServiceV1({ ...verifierFailure, approved: true })
      .complete(request())).rejects.toEqual(expect.objectContaining({
        kind: "verification_failed", message: "Retrieval completion is unavailable." }));
    const transactionFailure = deps(); transactionFailure.transactions.complete
      .mockRejectedValue(new Error("database detail"));
    await expect(createRetrievalCompletionServiceV1({ ...transactionFailure, approved: true })
      .complete(request())).rejects.toMatchObject({ kind: "verification_failed" });
  });
});

function deps(proof: unknown = verifiedProof()) { return {
  proofVerifier: { verify: vi.fn().mockResolvedValue(proof) },
  transactions: { complete: vi.fn().mockResolvedValue({ caseId: id("01"), caseState: "released",
    caseVersion: 8, closureRecorded: false, completedAt: "2026-08-18T12:00:01.000Z",
    completionId: id("03"), deliveryId: id("04"), exportPerformed: false,
    packageServed: true, releasePackageId: id("07"), replayed: false,
    retrievalCompleted: true, retrievalSessionId: id("08") }) } }; }
function request() { return { caseId: id("01"), claimantKeyId: id("02"),
  completionId: id("03"), deliveryId: id("04"),
  deliveryKey: "synthetic_package_delivery_slice_4g", idempotencyKey: id("05"),
  manifestDigest: "a".repeat(64),
  nativeOpenSessionReference: `claimant-package-open.v1.${id("09")}`,
  openedAt: "2026-08-18T12:00:00.000Z", payloadDigest: "c".repeat(64),
  portalSessionId: id("06"), proof: { opaque: "assertion" }, releasePackageId: id("07"),
  retrievalSessionId: id("08") }; }
function verifiedProof() { return { appAttestKeyIdDigest: "A".repeat(42) + "E",
  bundleVersion: "1.0.0", caseId: id("01"), claimantKeyId: id("02"),
  completionId: id("03"), deliveryId: id("04"),
  deliveryKey: "synthetic_package_delivery_slice_4g", expectedPreviousCounter: 4,
  exportPerformed: false, manifestDigest: "a".repeat(64),
  nativeOpenSessionReference: `claimant-package-open.v1.${id("09")}`,
  openedAt: "2026-08-18T12:00:00.000Z", payloadDigest: "c".repeat(64),
  portalSessionId: id("06"), protocol: "sanduqkin:claim:native-open-proof:v1",
  releasePackageId: id("07"), retrievalSessionId: id("08"), syntheticOnly: true,
  validationCategory: 2, verifiedCounter: 5 }; }
function sha(value: string) { return createHash("sha256").update(value).digest("hex"); }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
