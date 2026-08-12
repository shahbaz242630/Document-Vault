import { describe, expect, it, vi } from "vitest";

import { createPrivateQuarantineTransactionClientV1,
  PrivateQuarantineTransactionError } from "./private-quarantine-transaction-client.js";

const ids = { case: "30000000-0000-4000-8000-000000000001",
  claimant: "30000000-0000-4000-8000-000000000002",
  attempt: "30000000-0000-4000-8000-000000000003",
  session: "30000000-0000-4000-8000-000000000004",
  object: "30000000-0000-4000-8000-000000000005" };

describe("private quarantine transaction client", () => {
  it("maps capability issuance without sending the raw secret", async () => {
    const path = `v1/${ids.case}/${ids.object}`;
    const rpc = vi.fn().mockResolvedValue({ data: { case_id: ids.case,
      expires_at: "2026-08-12T12:05:00.000Z", object_id: ids.object, object_path: path,
      replayed: false }, error: null });
    await createPrivateQuarantineTransactionClientV1(rpc).issue({ capabilityDigest: "a".repeat(64),
      caseId: ids.case, claimantUserId: ids.claimant, expectedCaseVersion: 2,
      expectedIntakeVersion: 2, expiresAt: "2026-08-12T12:05:00.000Z", idempotencyKey: ids.attempt,
      itemKey: "claimant_photo_identity", objectId: ids.object, objectPath: path,
      placeholderRef: "synthetic_evidence_001", portalSessionId: ids.session, preparationVersion: 2 });
    expect(rpc).toHaveBeenCalledWith("claimant_issue_evidence_upload_capability",
      expect.objectContaining({ p_capability_digest: "a".repeat(64), p_object_path: path }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("capabilityToken");
  });

  it("maps quarantine, scan and deletion lifecycle calls", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { case_id: ids.case, object_id: ids.object,
      status: "quarantined", version: 1, replayed: false }, error: null });
    const client = createPrivateQuarantineTransactionClientV1(rpc);
    await client.quarantine({ archiveEntryCount: 1, capabilityDigest: "a".repeat(64),
      contentDigest: "b".repeat(64), deleteAfter: "2026-09-01T00:00:00.000Z",
      detectedMediaType: "application/pdf", expandedSizeBytes: 2048, idempotencyKey: ids.attempt,
      objectId: ids.object, objectPath: `v1/${ids.case}/${ids.object}`, pageCount: 1,
      processorUserId: ids.claimant, sizeBytes: 1024 });
    rpc.mockResolvedValueOnce({ data: { case_id: ids.case, object_id: ids.object,
      status: "clean", version: 2, replayed: false }, error: null });
    await client.scan({ expectedVersion: 1, idempotencyKey: ids.attempt,
      objectId: ids.object, processorUserId: ids.claimant, scanResult: "clean" });
    rpc.mockResolvedValueOnce({ data: { case_id: ids.case, object_id: ids.object,
      status: "deleted", version: 3, replayed: false }, error: null });
    await client.planDeletion({ expectedVersion: 2, idempotencyKey: ids.attempt,
      objectId: ids.object, processorUserId: ids.claimant });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "claimant_record_evidence_quarantine", "claimant_record_evidence_scan",
      "claimant_plan_evidence_deletion" ]);
  });

  it("redacts RPC failures and rejects unexpected states", async () => {
    const failure = vi.fn().mockResolvedValue({ data: null,
      error: { code: "42501", message: "private path" } });
    const error = await createPrivateQuarantineTransactionClientV1(failure)
      .confirmDeleted({ expectedVersion: 1, idempotencyKey: ids.attempt, objectId: ids.object,
        processorUserId: ids.claimant }).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(PrivateQuarantineTransactionError);
    expect(JSON.stringify(error)).not.toContain("private path");
    const invalid = vi.fn().mockResolvedValue({ data: { case_id: ids.case, object_id: ids.object,
      status: "served", version: 1, replayed: false }, error: null });
    await expect(createPrivateQuarantineTransactionClientV1(invalid).confirmDeleted({ expectedVersion: 1,
      idempotencyKey: ids.attempt, objectId: ids.object, processorUserId: ids.claimant }))
      .rejects.toThrow("invalid result");
  });
});
