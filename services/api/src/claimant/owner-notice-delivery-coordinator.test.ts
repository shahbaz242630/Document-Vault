import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { createOwnerNoticeDeliveryCoordinatorV1, OwnerNoticeDeliveryError }
  from "./owner-notice-delivery-coordinator.js";

const ids = { case: "90000000-0000-4000-8000-000000000001",
  cycle: "90000000-0000-4000-8000-000000000002",
  outbox: "90000000-0000-4000-8000-000000000003",
  request: "90000000-0000-4000-8000-000000000004",
  delivery: "90000000-0000-4000-8000-000000000005" };
const dispatchKey = `owner-notice:${ids.outbox}:${ids.delivery}`;

describe("owner notice delivery coordinator", () => {
  it("fails disabled before touching the queue or provider", async () => {
    const dependencies = adapters();
    await expect(createOwnerNoticeDeliveryCoordinatorV1(dependencies).runOne())
      .rejects.toMatchObject({ kind: "disabled" });
    expect(dependencies.queue.claim).not.toHaveBeenCalled();
    expect(dependencies.provider.dispatch).not.toHaveBeenCalled();
  });

  it("starts cooldown only from exact verified provider lookup", async () => {
    const dependencies = adapters();
    const coordinator = createOwnerNoticeDeliveryCoordinatorV1({ ...dependencies, approved: true });
    const output = await coordinator.runOne();
    const canonical = JSON.stringify({ deliveredAt: "2026-08-18T12:00:00.000Z", dispatchKey,
      providerMessageDigest: "a".repeat(64), receiptRef: "opaque_receipt_alpha_001",
      status: "verified" });
    expect(dependencies.provider.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      dispatchKey, noticeRef: "synthetic_owner_notice_alpha_001" }));
    expect(dependencies.transactions.recordDelivery).toHaveBeenCalledWith(expect.objectContaining({
      caseId: ids.case, cycleId: ids.cycle,
      deliveryEvidenceDigest: createHash("sha256").update(canonical).digest("hex"),
      idempotencyKey: ids.delivery, outcome: "verified" }));
    expect(dependencies.queue.complete).toHaveBeenCalledWith(expect.objectContaining({
      caseVersion: 5, outcome: "verified", outboxId: ids.outbox }));
    expect(output?.outcome).toBe("verified");
  });

  it("reconciles a dispatch exception through lookup without trusting the acknowledgement", async () => {
    const dependencies = adapters();
    dependencies.provider.dispatch.mockRejectedValueOnce(new Error("private provider detail"));
    await expect(createOwnerNoticeDeliveryCoordinatorV1({ ...dependencies, approved: true })
      .runOne()).resolves.toMatchObject({ outcome: "verified" });
    expect(dependencies.provider.lookup).toHaveBeenCalledTimes(1);
  });

  it("never redispatches a claimed retry and reuses its persisted idempotency authority", async () => {
    const dependencies = adapters();
    dependencies.queue.claim.mockResolvedValueOnce(work({ attemptNumber: 2 }));
    await createOwnerNoticeDeliveryCoordinatorV1({ ...dependencies, approved: true }).runOne();
    expect(dependencies.provider.dispatch).not.toHaveBeenCalled();
    expect(dependencies.provider.lookup).toHaveBeenCalledWith(expect.objectContaining({ dispatchKey }));
    expect(dependencies.transactions.recordDelivery).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: ids.delivery }));
  });

  it.each([["failed", "failed"], ["unknown", "ambiguous"]] as const)(
    "fails %s delivery closed as %s", async (providerStatus, outcome) => {
      const dependencies = adapters();
      dependencies.provider.lookup.mockResolvedValueOnce({ dispatchKey, status: providerStatus });
      dependencies.transactions.recordDelivery.mockResolvedValueOnce(result(outcome));
      dependencies.queue.complete.mockResolvedValueOnce({ outboxId: ids.outbox, status: "failed" });
      const output = await createOwnerNoticeDeliveryCoordinatorV1({ ...dependencies, approved: true })
        .runOne();
      expect(output?.outcome).toBe(outcome);
      expect(dependencies.transactions.recordDelivery).toHaveBeenCalledWith(expect.objectContaining({
        deliveryEvidenceDigest: null, outcome }));
      expect(dependencies.queue.complete).toHaveBeenCalledWith(expect.objectContaining({
        outcome }));
    });

  it("rejects cross-bound authority and requires reconciliation after ambiguous persistence", async () => {
    for (const hostile of [work({ aggregateId: ids.cycle }), work({ caseVersion: 7 }),
      { ...work(), privateOwnerAddress: "secret" }]) {
      const dependencies = adapters(); dependencies.queue.claim.mockResolvedValueOnce(hostile);
      await expect(createOwnerNoticeDeliveryCoordinatorV1({ ...dependencies, approved: true })
        .runOne()).rejects.toBeInstanceOf(OwnerNoticeDeliveryError);
      expect(dependencies.provider.dispatch).not.toHaveBeenCalled();
    }
    const ambiguous = adapters();
    ambiguous.transactions.recordDelivery.mockRejectedValueOnce(new Error("database detail"));
    const error = await createOwnerNoticeDeliveryCoordinatorV1({ ...ambiguous, approved: true })
      .runOne().catch((value: unknown) => value);
    expect(error).toMatchObject({ kind: "reconciliation_required" });
    expect(JSON.stringify(error)).not.toContain("database detail");
    expect(ambiguous.queue.complete).not.toHaveBeenCalled();
  });

  it("treats malformed or cross-dispatch lookup as ambiguous and serializes execution", async () => {
    const dependencies = adapters();
    dependencies.provider.lookup.mockResolvedValueOnce({ dispatchKey: "substituted", status: "verified",
      deliveredAt: "2026-08-18T12:00:00.000Z", providerMessageDigest: "a".repeat(64),
      receiptRef: "opaque_receipt_alpha_001" });
    dependencies.transactions.recordDelivery.mockResolvedValueOnce(result("ambiguous"));
    dependencies.queue.complete.mockResolvedValueOnce({ outboxId: ids.outbox, status: "failed" });
    await expect(createOwnerNoticeDeliveryCoordinatorV1({ ...dependencies, approved: true }).runOne())
      .resolves.toMatchObject({ outcome: "ambiguous" });

    let releaseClaim: ((value: unknown) => void) | undefined;
    const concurrent = adapters();
    concurrent.queue.claim.mockImplementationOnce(() => new Promise((resolve) => { releaseClaim = resolve; }));
    const coordinator = createOwnerNoticeDeliveryCoordinatorV1({ ...concurrent, approved: true });
    const first = coordinator.runOne();
    await expect(coordinator.runOne()).rejects.toMatchObject({ kind: "reconciliation_required" });
    releaseClaim?.(null); await expect(first).resolves.toBeNull();
  });
});

function adapters() {
  return { provider: { dispatch: vi.fn().mockResolvedValue({ accepted: true, dispatchKey }),
    lookup: vi.fn().mockResolvedValue({ deliveredAt: "2026-08-18T12:00:00.000Z", dispatchKey,
      providerMessageDigest: "a".repeat(64), receiptRef: "opaque_receipt_alpha_001",
      status: "verified" }) },
  queue: { claim: vi.fn().mockResolvedValue(work()), complete: vi.fn()
    .mockResolvedValue({ outboxId: ids.outbox, status: "delivered" }) },
  transactions: { begin: vi.fn(), stop: vi.fn(), recordDelivery: vi.fn()
    .mockResolvedValue(result("verified")) } };
}
function work(changes = {}) { return { aggregateId: ids.case, aggregateType: "case",
  attemptNumber: 1, caseId: ids.case, caseVersion: 4, cycleId: ids.cycle, cycleNumber: 1,
  dedupeKey: `owner_notice_requested:${ids.request}`, deliveryIdempotencyKey: ids.delivery,
  dispatchKey, noticeRef: "synthetic_owner_notice_alpha_001", noticeRequestId: ids.request,
  outboxId: ids.outbox, payload: { case_version: 4, cycle_number: 1,
    event: "owner_notice_requested" }, topic: "owner_notice_requested", ...changes }; }
function result(outcome: "ambiguous" | "failed" | "verified") { return { caseId: ids.case,
  caseVersion: 5, cooldownActive: outcome === "verified",
  cooldownExpiresAt: outcome === "verified" ? "2026-09-17T12:00:00.000Z" : null,
  cycleId: ids.cycle, cycleNumber: 1, releaseAuthorized: false, replayed: false,
  reviewStarted: false, state: outcome === "verified" ? "cooldown" : "on_hold",
  status: outcome === "verified" ? "delivery_verified" : `delivery_${outcome}` } as const; }
