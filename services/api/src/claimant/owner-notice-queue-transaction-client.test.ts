import { describe, expect, it, vi } from "vitest";

import { createOwnerNoticeQueueTransactionClientV1, OwnerNoticeQueueTransactionError }
  from "./owner-notice-queue-transaction-client.js";

const ids = { case: "91000000-0000-4000-8000-000000000001",
  cycle: "91000000-0000-4000-8000-000000000002",
  outbox: "91000000-0000-4000-8000-000000000003",
  request: "91000000-0000-4000-8000-000000000004",
  delivery: "91000000-0000-4000-8000-000000000005",
  lease: "91000000-0000-4000-8000-000000000006" };

describe("owner notice queue transaction client", () => {
  it("maps exact claim and completion RPC authority", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: claim(), error: null })
      .mockResolvedValueOnce({ data: { outbox_id: ids.outbox, status: "delivered" }, error: null });
    const queue = createOwnerNoticeQueueTransactionClientV1({ leaseSeconds: 60, rpc });
    const work = await queue.claim() as ReturnType<typeof mappedClaim>;
    expect(work).toEqual(mappedClaim());
    expect(rpc).toHaveBeenLastCalledWith("claimant_claim_owner_notice_delivery",
      { p_lease_seconds: 60 });
    await expect(queue.complete({ caseId: ids.case, caseVersion: 5, cycleId: ids.cycle,
      deliveryIdempotencyKey: ids.delivery, leaseToken: ids.lease, outboxId: ids.outbox,
      outcome: "verified" })).resolves.toEqual({ outboxId: ids.outbox, status: "delivered" });
    expect(rpc).toHaveBeenLastCalledWith("claimant_complete_owner_notice_delivery", {
      p_case_id: ids.case, p_case_version: 5, p_cycle_id: ids.cycle,
      p_delivery_idempotency_key: ids.delivery, p_lease_token: ids.lease,
      p_outbox_id: ids.outbox, p_outcome: "verified" });
  });

  it("accepts an empty queue and fails invalid lease configuration", async () => {
    const queue = createOwnerNoticeQueueTransactionClientV1({ leaseSeconds: 30,
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }) });
    await expect(queue.claim()).resolves.toBeNull();
    expect(() => createOwnerNoticeQueueTransactionClientV1({ leaseSeconds: 10,
      rpc: vi.fn() })).toThrow("lease configuration");
  });

  it("redacts RPC errors and rejects extra, cross-bound, or incoherent output", async () => {
    const failed = createOwnerNoticeQueueTransactionClientV1({ leaseSeconds: 60,
      rpc: vi.fn().mockResolvedValue({ data: null,
        error: { code: "42501", message: "private owner address" } }) });
    const error = await failed.claim().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(OwnerNoticeQueueTransactionError);
    expect(JSON.stringify(error)).not.toContain("address");
    for (const hostile of [{ ...claim(), owner_email: "private" },
      { ...claim(), aggregate_id: ids.cycle }, { ...claim(), attempt_number: 0 }]) {
      const queue = createOwnerNoticeQueueTransactionClientV1({ leaseSeconds: 60,
        rpc: vi.fn().mockResolvedValue({ data: hostile, error: null }) });
      await expect(queue.claim()).rejects.toThrow("invalid claim");
    }
  });

  it("rejects a completion response for another outbox or wrong terminal status", async () => {
    for (const response of [{ outbox_id: ids.cycle, status: "delivered" },
      { outbox_id: ids.outbox, status: "failed" }]) {
      const queue = createOwnerNoticeQueueTransactionClientV1({ leaseSeconds: 60,
        rpc: vi.fn().mockResolvedValue({ data: response, error: null }) });
      await expect(queue.complete({ caseId: ids.case, caseVersion: 5, cycleId: ids.cycle,
        deliveryIdempotencyKey: ids.delivery, leaseToken: ids.lease, outboxId: ids.outbox,
        outcome: "verified" })).rejects.toThrow("invalid completion");
    }
  });
});

function claim() { return { aggregate_id: ids.case, aggregate_type: "case", attempt_number: 1,
  case_id: ids.case, case_version: 4, cycle_id: ids.cycle, cycle_number: 1,
  dedupe_key: `owner_notice_requested:${ids.request}`, delivery_idempotency_key: ids.delivery,
  dispatch_key: `owner-notice:${ids.outbox}:${ids.delivery}`, lease_token: ids.lease,
  notice_ref: "synthetic_owner_notice_alpha_001", notice_request_id: ids.request,
  outbox_id: ids.outbox, payload: { case_version: 4, cycle_number: 1,
    event: "owner_notice_requested" }, topic: "owner_notice_requested" }; }
function mappedClaim() { const value = claim(); return { aggregateId: value.aggregate_id,
  aggregateType: value.aggregate_type, attemptNumber: value.attempt_number, caseId: value.case_id,
  caseVersion: value.case_version, cycleId: value.cycle_id, cycleNumber: value.cycle_number,
  dedupeKey: value.dedupe_key, deliveryIdempotencyKey: value.delivery_idempotency_key,
  dispatchKey: value.dispatch_key, leaseToken: value.lease_token, noticeRef: value.notice_ref,
  noticeRequestId: value.notice_request_id, outboxId: value.outbox_id, payload: value.payload,
  topic: value.topic }; }
