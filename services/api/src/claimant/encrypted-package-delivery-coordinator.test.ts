import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_ENCRYPTED_PACKAGE_DELIVERY_APPROVED,
  createEncryptedPackageDeliveryCoordinatorV1 }
  from "./encrypted-package-delivery-coordinator.js";

describe("encrypted package delivery coordinator", () => {
  it("is immutable-false by default", async () => {
    expect(CLAIMANT_ENCRYPTED_PACKAGE_DELIVERY_APPROVED).toBe(false);
    await expect(coordinator().deliver(request())).rejects.toMatchObject({ kind: "disabled" });
  });
  it("dispatches exact encrypted bytes once, verifies lookup, then commits", async () => {
    const deps = dependencies();
    await expect(coordinator({ approved: true, ...deps }).deliver(request()))
      .resolves.toMatchObject({ caseState: "released", packageServed: true,
        retrievalCompleted: false });
    expect(deps.adapter.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      deliveryKey: DELIVERY_KEY, payload: PAYLOAD }));
    expect(deps.transactions.commit).toHaveBeenCalledWith(expect.objectContaining({
      receiptDigest: receiptDigest(), receiptRef: RECEIPT_REF }));
  });
  it("never redispatches a replay and uses stable-key lookup as sole authority", async () => {
    const deps = dependencies({ replayed: true });
    await coordinator({ approved: true, ...deps }).deliver(request());
    expect(deps.adapter.dispatch).not.toHaveBeenCalled();
    expect(deps.adapter.lookup).toHaveBeenCalledWith(expect.objectContaining({
      deliveryKey: DELIVERY_KEY }));
  });
  it("fails closed for unknown, failed, malformed, or mismatched delivery evidence", async () => {
    for (const lookup of [{ deliveryKey: DELIVERY_KEY, status: "unknown" },
      { deliveryKey: DELIVERY_KEY, status: "failed" },
      { ...verified(), payloadDigest: "0".repeat(64) },
      { ...verified(), payloadBytes: 999 }, { ...verified(), extra: true }]) {
      const deps = dependencies({ lookup });
      await expect(coordinator({ approved: true, ...deps }).deliver(request()))
        .rejects.toMatchObject({ kind: "reconciliation_required" });
      expect(deps.transactions.commit).not.toHaveBeenCalled();
    }
  });
  it("rejects malformed authority and serializes concurrent delivery", async () => {
    await expect(coordinator({ approved: true }).deliver({ ...request(), extra: true }))
      .rejects.toMatchObject({ kind: "invalid_input" });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const deps = dependencies({ dispatch: vi.fn(async () => { await blocked;
      return { accepted: true, deliveryKey: DELIVERY_KEY }; }) });
    const service = coordinator({ approved: true, ...deps });
    const first = service.deliver(request());
    await Promise.resolve();
    await expect(service.deliver(request())).rejects.toMatchObject({
      kind: "reconciliation_required" });
    release(); await first;
  });
});

const DELIVERY_KEY = "synthetic_package_delivery_slice_4e";
const RECEIPT_REF = "synthetic_delivery_receipt_slice_4e";
const PAYLOAD = JSON.stringify({ encrypted: "A".repeat(600) });
const PAYLOAD_DIGEST = createHash("sha256").update(PAYLOAD).digest("hex");
function prepared(replayed = false) { return { caseId: id("01"), caseState: "release_ready",
  caseVersion: 7, deliveryId: id("05"), deliveryKey: DELIVERY_KEY,
  deliveryPayload: PAYLOAD, deliveryStatus: "prepared_unserved", finalizationId: id("02"),
  grantId: id("11"), leaseExpiresAt: "2026-08-18T12:02:00.000Z", packageServed: false,
  payload: {} as never, payloadBytes: Buffer.byteLength(PAYLOAD), payloadDigest: PAYLOAD_DIGEST,
  recipientKeyId: id("31"), releasePackageId: id("04"), replayed,
  retrievalCompleted: false, retrievalSessionId: id("06") } as const; }
function verified() { return { completedAt: "2026-08-18T12:01:00.000Z",
  deliveryKey: DELIVERY_KEY, payloadBytes: Buffer.byteLength(PAYLOAD),
  payloadDigest: PAYLOAD_DIGEST, receiptRef: RECEIPT_REF, status: "verified" }; }
function receiptDigest() { return createHash("sha256").update([
  "sanduqkin:claim:encrypted-delivery-receipt:v1", DELIVERY_KEY, PAYLOAD_DIGEST,
  String(Buffer.byteLength(PAYLOAD)), "2026-08-18T12:01:00.000Z", RECEIPT_REF,
].join("|")).digest("hex"); }
function dependencies(options: Record<string, unknown> = {}) {
  const adapter = { dispatch: (options.dispatch ?? vi.fn(async () => ({ accepted: true,
    deliveryKey: DELIVERY_KEY }))) as ReturnType<typeof vi.fn>,
    lookup: vi.fn(async () => options.lookup ?? verified()) };
  const transactions = { prepare: vi.fn(async () => prepared(Boolean(options.replayed))),
    commit: vi.fn(async () => ({ caseId: id("01"), caseState: "released", caseVersion: 8,
      deliveryId: id("05"), deliveryKey: DELIVERY_KEY, deliveryStatus: "served",
      firstSuccessfulDelivery: true, packageServed: true, receiptRef: RECEIPT_REF,
      releasePackageId: id("04"), replayed: false, retrievalCompleted: false,
      retrievalSessionId: id("06"), servedAt: "2026-08-18T12:01:00.000Z" } as const)) };
  return { adapter, transactions };
}
function coordinator(options: Record<string, unknown> = {}) {
  const deps = dependencies(); return createEncryptedPackageDeliveryCoordinatorV1({
    adapter: (options.adapter ?? deps.adapter) as never,
    approved: options.approved as boolean | undefined,
    transactions: (options.transactions ?? deps.transactions) as never });
}
function request() { return { caseId: id("01"), commitIdempotencyKey: id("08"),
  deliveryId: id("05"), deliveryKey: DELIVERY_KEY, expectedCaseVersion: 7,
  idempotencyKey: id("07"), retrievalSessionId: id("06") }; }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
