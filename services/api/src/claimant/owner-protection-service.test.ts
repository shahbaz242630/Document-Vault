import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_OWNER_PROTECTION_APPROVED, createOwnerProtectionServiceV1,
  OwnerProtectionServiceError } from "./owner-protection-service.js";

const ids = { case: "80000000-0000-4000-8000-000000000001",
  cycle: "80000000-0000-4000-8000-000000000002",
  attempt: "80000000-0000-4000-8000-000000000003",
  owner: "80000000-0000-4000-8000-000000000004" };

describe("owner protection service", () => {
  it("is immutable-false and touches no transaction while disabled", async () => {
    expect(CLAIMANT_OWNER_PROTECTION_APPROVED).toBe(false); const transactions = mocks();
    await expect(createOwnerProtectionServiceV1({ transactions }).begin(begin()))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(transactions.begin).not.toHaveBeenCalled();
  });

  it("passes exact bounded notice, delivery, and stop authority", async () => {
    const transactions = mocks(); const service = createOwnerProtectionServiceV1({
      approved: true, transactions });
    await service.begin(begin()); await service.recordDelivery(delivery()); await service.stop(stop());
    expect(transactions.begin).toHaveBeenCalledWith(begin());
    expect(transactions.recordDelivery).toHaveBeenCalledWith(delivery());
    expect(transactions.stop).toHaveBeenCalledWith(stop());
  });

  it("rejects missing verified evidence and evidence on failed delivery", async () => {
    const service = enabled();
    for (const value of [delivery({ deliveryEvidenceDigest: null }),
      delivery({ outcome: "failed", deliveryEvidenceDigest: "a".repeat(64) })]) {
      await expect(service.recordDelivery(value)).rejects.toBeInstanceOf(OwnerProtectionServiceError);
    }
  });

  it("binds user authority only to owner cancellation or claimant dispute", async () => {
    const service = enabled();
    for (const value of [stop({ reason: "material_change", actorUserId: ids.owner }),
      stop({ reason: "owner_cancelled", actorUserId: null })]) {
      await expect(service.stop(value)).rejects.toMatchObject({ kind: "invalid_input" });
    }
  });
});

function mocks() { return { begin: vi.fn(), recordDelivery: vi.fn(), stop: vi.fn() }; }
function enabled() { return createOwnerProtectionServiceV1({ approved: true, transactions: mocks() }); }
function begin() { return { caseId: ids.case, cooldownSeconds: 2592000,
  expectedCaseVersion: 3, idempotencyKey: ids.attempt,
  noticeRef: "synthetic_owner_notice_alpha_001" }; }
function delivery(changes = {}) { return { caseId: ids.case, cycleId: ids.cycle,
  deliveryEvidenceDigest: "a".repeat(64), expectedCaseVersion: 4,
  idempotencyKey: ids.attempt, noticeRef: "synthetic_owner_notice_alpha_001",
  outcome: "verified" as const, ...changes }; }
function stop(changes = {}) { return { actorUserId: ids.owner, caseId: ids.case,
  cycleId: ids.cycle, expectedCaseVersion: 4, idempotencyKey: ids.attempt,
  reason: "owner_cancelled" as const, ...changes }; }
