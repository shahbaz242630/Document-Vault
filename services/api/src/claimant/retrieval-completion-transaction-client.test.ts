import { describe, expect, it, vi } from "vitest";

import { createRetrievalCompletionTransactionClientV1,
  RetrievalCompletionTransactionError } from "./retrieval-completion-transaction-client";

describe("retrieval completion transaction client", () => {
  it("maps the exact verified proof into the completion RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result(), error: null });
    await expect(createRetrievalCompletionTransactionClientV1(rpc).complete(input()))
      .resolves.toMatchObject({ caseState: "released", retrievalCompleted: true,
        exportPerformed: false, closureRecorded: false });
    expect(rpc).toHaveBeenCalledWith("claimant_complete_verified_native_open", {
      p_app_attest_key_id_digest: input().appAttestKeyIdDigest,
      p_bundle_version: "1.0.0", p_case_id: input().caseId,
      p_claimant_key_id: input().claimantKeyId, p_completion_id: input().completionId,
      p_delivery_id: input().deliveryId, p_delivery_key: input().deliveryKey,
      p_expected_previous_counter: 4, p_idempotency_key: input().idempotencyKey,
      p_manifest_digest: input().manifestDigest,
      p_native_open_session_digest: input().nativeOpenSessionDigest,
      p_opened_at: input().openedAt, p_payload_digest: input().payloadDigest,
      p_portal_session_id: input().portalSessionId,
      p_release_package_id: input().releasePackageId,
      p_retrieval_session_id: input().retrievalSessionId,
      p_validation_category: 2, p_verified_counter: 5,
      p_verified_proof_digest: input().verifiedProofDigest });
  });

  it("redacts RPC errors and rejects hostile success projections", async () => {
    const failed = vi.fn().mockResolvedValue({ data: null, error: { code: "40001" } });
    await expect(createRetrievalCompletionTransactionClientV1(failed).complete(input()))
      .rejects.toEqual(expect.objectContaining<Partial<RetrievalCompletionTransactionError>>({
        code: "40001", message: "Retrieval completion transaction failed." }));
    for (const data of [{ ...result(), export_performed: true },
      { ...result(), retrieval_completed: false }, { ...result(), claimant_user_id: id("99") },
      { ...result(), completion_id: id("99") }]) {
      const rpc = vi.fn().mockResolvedValue({ data, error: null });
      await expect(createRetrievalCompletionTransactionClientV1(rpc).complete(input()))
        .rejects.toThrow("invalid data");
    }
  });
});

function input() { return { appAttestKeyIdDigest: "A".repeat(42) + "E",
  bundleVersion: "1.0.0", caseId: id("01"), claimantKeyId: id("02"),
  completionId: id("03"), deliveryId: id("04"),
  deliveryKey: "synthetic_package_delivery_slice_4g", expectedPreviousCounter: 4,
  idempotencyKey: id("05"), manifestDigest: "a".repeat(64),
  nativeOpenSessionDigest: "b".repeat(64), openedAt: "2026-08-18T12:00:00.000Z",
  payloadDigest: "c".repeat(64), portalSessionId: id("06"), releasePackageId: id("07"),
  retrievalSessionId: id("08"), validationCategory: 2 as const, verifiedCounter: 5,
  verifiedProofDigest: "d".repeat(64) }; }
function result() { return { case_id: input().caseId, case_state: "released", case_version: 8,
  closure_recorded: false, completed_at: "2026-08-18T12:00:01.000Z",
  completion_id: input().completionId, delivery_id: input().deliveryId,
  export_performed: false, package_served: true, release_package_id: input().releasePackageId,
  replayed: false, retrieval_completed: true, retrieval_session_id: input().retrievalSessionId }; }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
