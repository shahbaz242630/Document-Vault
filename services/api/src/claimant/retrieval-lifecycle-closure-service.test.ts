import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_RETRIEVAL_LIFECYCLE_CLOSURE_APPROVED,
  createRetrievalLifecycleClosureServiceV1, RetrievalLifecycleClosureServiceError }
  from "./retrieval-lifecycle-closure-service";

describe("retrieval lifecycle closure service", () => {
  it("is immutable-false and performs no verification or database work by default", async () => {
    expect(CLAIMANT_RETRIEVAL_LIFECYCLE_CLOSURE_APPROVED).toBe(false);
    const dependencies = deps();
    await expect(createRetrievalLifecycleClosureServiceV1(dependencies).close(request()))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(dependencies.exportFactVerifier.verify).not.toHaveBeenCalled();
    expect(dependencies.transactions.close).not.toHaveBeenCalled();
  });

  it("records closure without inventing an export fact", async () => {
    const dependencies = deps();
    await expect(createRetrievalLifecycleClosureServiceV1({ ...dependencies, approved: true })
      .close(request())).resolves.toMatchObject({ closureRecorded: true,
        exportPerformed: false, localContentDeleted: false, localContentRecalled: false });
    expect(dependencies.exportFactVerifier.verify).not.toHaveBeenCalled();
    expect(dependencies.transactions.close).toHaveBeenCalledWith(expect.objectContaining({
      exportPerformed: false, exportReceiptDigest: null, exportedAt: null,
      verifiedExportFactDigest: null }));
  });

  it("persists only digests from an exactly bound verified export fact", async () => {
    const dependencies = deps();
    const value = { ...request(), exportReceipt: { opaque: "native receipt" } };
    await createRetrievalLifecycleClosureServiceV1({ ...dependencies, approved: true }).close(value);
    expect(dependencies.exportFactVerifier.verify).toHaveBeenCalledWith({
      expected: expect.objectContaining({ closureId: value.closureId,
        completionId: value.completionId }), receipt: value.exportReceipt });
    const fact = verifiedFact(); const receiptDigest = sha(fact.exportReceiptReference);
    const proofDigest = sha(["sanduqkin:claim:local-export-receipt:v1", value.closureId,
      fact.completionId, fact.deliveryId,
      fact.retrievalSessionId, fact.caseId, fact.releasePackageId, String(fact.assetCount),
      receiptDigest, fact.exportedAt,
      fact.destinationClass, "true", "false", "false", "false", "exported"].join("|"));
    expect(dependencies.transactions.close).toHaveBeenCalledWith(expect.objectContaining({
      exportPerformed: true, exportReceiptDigest: receiptDigest,
      verifiedExportFactDigest: proofDigest, exportedAt: fact.exportedAt }));
  });

  it.each([null, {}, { ...request(), expectedCaseVersion: 4 },
    { ...request(), closureReason: "delete_local_content" }, { ...request(), extra: true }])
  ("rejects malformed closure input before dependencies", async (value) => {
    const dependencies = deps();
    await expect(createRetrievalLifecycleClosureServiceV1({ ...dependencies, approved: true })
      .close(value)).rejects.toBeInstanceOf(RetrievalLifecycleClosureServiceError);
    expect(dependencies.exportFactVerifier.verify).not.toHaveBeenCalled();
    expect(dependencies.transactions.close).not.toHaveBeenCalled();
  });

  it("rejects substituted or unsafe export facts before persistence", async () => {
    for (const fact of [{ ...verifiedFact(), completionId: id("99") },
      { ...verifiedFact(), localCopyCreated: false },
      { ...verifiedFact(), plaintextReturnedToJavaScript: true },
      { ...verifiedFact(), serverUploadPerformed: true },
      { ...verifiedFact(), closureRecorded: true }, { ...verifiedFact(), plaintext: "secret" }]) {
      const dependencies = deps(fact);
      await expect(createRetrievalLifecycleClosureServiceV1({ ...dependencies, approved: true })
        .close({ ...request(), exportReceipt: {} })).rejects.toMatchObject({
          kind: "verification_failed" });
      expect(dependencies.transactions.close).not.toHaveBeenCalled();
    }
  });

  it("redacts verifier and transaction failures", async () => {
    const verifierFailure = deps();
    verifierFailure.exportFactVerifier.verify.mockRejectedValue(new Error("secret"));
    await expect(createRetrievalLifecycleClosureServiceV1({ ...verifierFailure, approved: true })
      .close({ ...request(), exportReceipt: {} })).rejects.toEqual(expect.objectContaining({
        kind: "verification_failed", message: "Retrieval lifecycle closure is unavailable." }));
    const transactionFailure = deps();
    transactionFailure.transactions.close.mockRejectedValue(new Error("database detail"));
    await expect(createRetrievalLifecycleClosureServiceV1({ ...transactionFailure, approved: true })
      .close(request())).rejects.toMatchObject({ kind: "verification_failed" });
  });
});

function deps(fact: unknown = verifiedFact()) { return {
  exportFactVerifier: { verify: vi.fn().mockResolvedValue(fact) },
  transactions: { close: vi.fn().mockResolvedValue(result()) } }; }
function request() { return { caseId: id("01"), closureId: id("02"),
  closureReason: "retrieval_lifecycle_complete" as const, completionId: id("03"),
  deliveryId: id("04"), expectedCaseVersion: 8, exportReceipt: null,
  idempotencyKey: id("05"), releasePackageId: id("06"), retrievalSessionId: id("07") }; }
function verifiedFact() { return { assetCount: 2, caseId: id("01"),
  closureRecorded: false, completionId: id("03"), deliveryId: id("04"),
  destinationClass: "user_selected_local_copy", exportedAt: "2026-08-18T12:01:00.000Z",
  exportReceiptReference: `claimant-local-export.v1.${id("08")}`, localCopyCreated: true,
  plaintextReturnedToJavaScript: false,
  releasePackageId: id("06"), retrievalSessionId: id("07"),
  serverUploadPerformed: false, status: "exported" }; }
function result() { return { caseId: id("01"), caseState: "released" as const, caseVersion: 8,
  closedAt: "2026-08-18T12:02:00.000Z", closureId: id("02"), closureRecorded: true as const,
  completionId: id("03"), deliveryId: id("04"), exportPerformed: false,
  historicalCompletionPreserved: true as const, historicalDeliveryPreserved: true as const,
  localContentDeleted: false as const, localContentRecalled: false as const,
  releasePackageId: id("06"), replayed: false, retrievalSessionId: id("07") }; }
function sha(value: string) { return createHash("sha256").update(value).digest("hex"); }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
