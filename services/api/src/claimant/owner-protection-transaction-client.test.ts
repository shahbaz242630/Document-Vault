import { describe, expect, it, vi } from "vitest";

import { createOwnerProtectionTransactionClientV1, OwnerProtectionTransactionError }
  from "./owner-protection-transaction-client.js";

const ids = { case: "80000000-0000-4000-8000-000000000001",
  cycle: "80000000-0000-4000-8000-000000000002",
  attempt: "80000000-0000-4000-8000-000000000003",
  owner: "80000000-0000-4000-8000-000000000004" };

describe("owner protection transaction client", () => {
  it("maps the three exact service-only RPC boundaries", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: result(), error: null })
      .mockResolvedValueOnce({ data: result({ case_version: 5, cooldown_active: true,
        cooldown_expires_at: "2026-09-17T12:00:00.000Z", cycle_id: ids.cycle,
        state: "cooldown", status: "delivery_verified" }), error: null })
      .mockResolvedValueOnce({ data: result({ case_version: 5, cycle_id: ids.cycle,
        state: "cancelled_by_owner", status: "cancelled" }), error: null });
    const client = createOwnerProtectionTransactionClientV1(rpc);
    await client.begin({ caseId: ids.case, cooldownSeconds: 2592000, expectedCaseVersion: 3,
      idempotencyKey: ids.attempt, noticeRef: "synthetic_owner_notice_alpha_001" });
    expect(rpc).toHaveBeenLastCalledWith("claimant_begin_owner_notice", {
      p_case_id: ids.case, p_cooldown_seconds: 2592000, p_expected_case_version: 3,
      p_idempotency_key: ids.attempt, p_notice_ref: "synthetic_owner_notice_alpha_001" });
    await client.recordDelivery({ caseId: ids.case, cycleId: ids.cycle,
      deliveryEvidenceDigest: "a".repeat(64), expectedCaseVersion: 4,
      idempotencyKey: ids.attempt, noticeRef: "synthetic_owner_notice_alpha_001",
      outcome: "verified" });
    expect(rpc).toHaveBeenLastCalledWith("claimant_record_owner_notice_delivery",
      expect.objectContaining({ p_cycle_id: ids.cycle, p_outcome: "verified" }));
    await client.stop({ actorUserId: ids.owner, caseId: ids.case, cycleId: ids.cycle,
      expectedCaseVersion: 4, idempotencyKey: ids.attempt, reason: "owner_cancelled" });
    expect(rpc).toHaveBeenLastCalledWith("claimant_stop_owner_protection",
      expect.objectContaining({ p_actor_user_id: ids.owner, p_reason: "owner_cancelled" }));
  });

  it("redacts RPC detail and rejects unsafe or incoherent results", async () => {
    const failed = createOwnerProtectionTransactionClientV1(vi.fn().mockResolvedValue({ data: null,
      error: { code: "42501", message: "private owner address" } }));
    const error = await failed.begin(begin()).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(OwnerProtectionTransactionError);
    expect(JSON.stringify(error)).not.toContain("address");
    for (const hostile of [{ ...result(), release_authorized: true },
      { ...result(), reviewer_id: "private" }, { ...result(), cooldown_active: true },
      { ...result(), case_id: "80000000-0000-4000-8000-000000000099" },
      { ...result(), case_version: 9 }, { ...result(), state: "on_hold", status: "invalidated" }]) {
      const client = createOwnerProtectionTransactionClientV1(vi.fn().mockResolvedValue({
        data: hostile, error: null }));
      await expect(client.begin(begin())).rejects.toThrow("invalid result");
    }
  });
});

function begin() { return { caseId: ids.case, cooldownSeconds: 2592000,
  expectedCaseVersion: 3, idempotencyKey: ids.attempt,
  noticeRef: "synthetic_owner_notice_alpha_001" }; }
function result(changes = {}) { return { case_id: ids.case, case_version: 4, cooldown_active: false,
  cooldown_expires_at: null, cycle_id: ids.cycle, cycle_number: 1,
  release_authorized: false, replayed: false, review_started: false,
  state: "owner_notified", status: "pending_delivery", ...changes }; }
