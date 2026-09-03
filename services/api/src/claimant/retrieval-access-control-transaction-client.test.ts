import { describe, expect, it, vi } from "vitest";

import { createRetrievalAccessControlTransactionClientV1,
  RetrievalAccessControlTransactionError }
  from "./retrieval-access-control-transaction-client.js";

const id = { caseId: "10000000-0000-4000-8000-000000000001",
  controlId: "10000000-0000-4000-8000-000000000002",
  finalizationId: "10000000-0000-4000-8000-000000000003",
  idempotencyKey: "10000000-0000-4000-8000-000000000004" };
const input = { ...id, controlState: "suspended" as const, expectedCaseVersion: 8,
  reason: "synthetic_security_hold" as const };
const result = { case_id: id.caseId, case_state: "released", case_version: 8,
  control_id: id.controlId, control_state: "suspended", effective_at: new Date().toISOString(),
  finalization_id: id.finalizationId, future_retrieval_authorized: false,
  future_serving_authorized: false, local_content_deleted: false,
  local_content_recalled: false, package_was_served: true, replayed: false,
  retrieval_was_completed: true };

describe("retrieval access control transaction client", () => {
  it("maps the exact service-only RPC and safe response", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
    await expect(createRetrievalAccessControlTransactionClientV1(rpc).endAccess(input))
      .resolves.toMatchObject({ controlState: "suspended", localContentRecalled: false,
        localContentDeleted: false, futureServingAuthorized: false });
    expect(rpc).toHaveBeenCalledWith("claimant_end_release_retrieval_access", {
      p_case_id: id.caseId, p_control_id: id.controlId, p_control_state: "suspended",
      p_expected_case_version: 8, p_finalization_id: id.finalizationId,
      p_idempotency_key: id.idempotencyKey, p_reason: "synthetic_security_hold" });
  });
  it("rejects substituted or internally inconsistent results", async () => {
    for (const data of [{ ...result, case_id: id.controlId },
      { ...result, package_was_served: false }, { ...result, local_content_recalled: true }])
      await expect(createRetrievalAccessControlTransactionClientV1(
        vi.fn().mockResolvedValue({ data, error: null })).endAccess(input)).rejects.toThrow();
  });
  it("reduces RPC errors", async () => {
    await expect(createRetrievalAccessControlTransactionClientV1(
      vi.fn().mockResolvedValue({ data: null, error: { code: "40001" } }))
      .endAccess(input)).rejects.toBeInstanceOf(RetrievalAccessControlTransactionError);
  });
});
