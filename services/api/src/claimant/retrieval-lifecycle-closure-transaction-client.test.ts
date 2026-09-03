import { describe, expect, it, vi } from "vitest";

import { createRetrievalLifecycleClosureTransactionClientV1,
  RetrievalLifecycleClosureTransactionError }
  from "./retrieval-lifecycle-closure-transaction-client";

describe("retrieval lifecycle closure transaction client", () => {
  it("maps the exact administrative closure into the service-only RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result(), error: null });
    await expect(createRetrievalLifecycleClosureTransactionClientV1(rpc).close(input()))
      .resolves.toMatchObject({ closureRecorded: true, historicalCompletionPreserved: true,
        historicalDeliveryPreserved: true, localContentDeleted: false,
        localContentRecalled: false });
    expect(rpc).toHaveBeenCalledWith("claimant_close_retrieval_lifecycle", {
      p_case_id: input().caseId, p_closure_id: input().closureId,
      p_closure_reason: "retrieval_lifecycle_complete", p_completion_id: input().completionId,
      p_delivery_id: input().deliveryId, p_expected_case_version: 8,
      p_export_performed: false, p_export_receipt_digest: null, p_exported_at: null,
      p_idempotency_key: input().idempotencyKey,
      p_release_package_id: input().releasePackageId,
      p_retrieval_session_id: input().retrievalSessionId,
      p_verified_export_fact_digest: null });
  });

  it("redacts RPC errors and rejects hostile success projections", async () => {
    const failed = vi.fn().mockResolvedValue({ data: null, error: { code: "40001" } });
    await expect(createRetrievalLifecycleClosureTransactionClientV1(failed).close(input()))
      .rejects.toEqual(expect.objectContaining<Partial<RetrievalLifecycleClosureTransactionError>>({
        code: "40001", message: "Retrieval lifecycle closure transaction failed." }));
    for (const data of [{ ...result(), closure_recorded: false },
      { ...result(), local_content_deleted: true },
      { ...result(), historical_completion_preserved: false },
      { ...result(), closure_id: id("99") }, { ...result(), claimant_user_id: id("99") }]) {
      const rpc = vi.fn().mockResolvedValue({ data, error: null });
      await expect(createRetrievalLifecycleClosureTransactionClientV1(rpc).close(input()))
        .rejects.toThrow("invalid data");
    }
  });
});

function input() { return { caseId: id("01"), closureId: id("02"),
  closureReason: "retrieval_lifecycle_complete" as const, completionId: id("03"),
  deliveryId: id("04"), expectedCaseVersion: 8, exportPerformed: false,
  exportReceiptDigest: null, exportedAt: null, idempotencyKey: id("05"),
  releasePackageId: id("06"), retrievalSessionId: id("07"),
  verifiedExportFactDigest: null }; }
function result() { return { case_id: id("01"), case_state: "released", case_version: 8,
  closed_at: "2026-08-18T12:02:00.000Z", closure_id: id("02"), closure_recorded: true,
  completion_id: id("03"), delivery_id: id("04"), export_performed: false,
  historical_completion_preserved: true, historical_delivery_preserved: true,
  local_content_deleted: false, local_content_recalled: false,
  release_package_id: id("06"), replayed: false, retrieval_session_id: id("07") }; }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
