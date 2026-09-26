import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_SINGLE_APPROVER_REVIEW_APPROVED, createSingleApproverReviewServiceV1 }
  from "./single-approver-review-service.js";
import { createSingleApproverReviewTransactionClientV1, SingleApproverReviewTransactionError }
  from "./single-approver-review-transaction-client.js";

const id = (last: string) => `c7000000-0000-4000-8000-0000000000${last}`;
const hex = (character: string) => character.repeat(64);
const checks = { policy_single_approver: true, case_current: true, claimant_is_not_owner: true,
  owner_notice_verified: true, cooldown_elapsed: true, cooldown_meets_minimum: true, submission_received: true,
  checklist_complete: true, evidence_complete: true, no_other_open_claim: true, no_intervention: true,
  recipient_keys_current: true };

function decision(changes = {}) {
  return { caseId: id("01"), cycleId: id("02"), assignmentId: id("03"), reviewerIdentityId: id("04"),
    precheckId: id("05"), expectedCaseVersion: 5, expectedAssignmentVersion: 1, expectedSubmissionCaseVersion: 3,
    expectedIntakeVersion: 9, expectedPreparationVersion: 9, policyPackId: "synthetic_policy_single_alpha",
    policyPackVersion: 1, checklistDigest: hex("a"), evidenceManifestDigest: hex("b"), decision: "allow",
    reasonClass: "requirements_satisfied", idempotencyKey: id("06"), ...changes };
}
function release(changes = {}) {
  return { caseId: id("01"), cycleId: id("02"), reviewRoundId: id("07"), authorityIdentityId: id("08"),
    releasePrecheckId: id("09"), expectedCaseVersion: 5, expectedRoundVersion: 2, expectedBindingVersion: 2,
    expectedFinalizationVersion: 1, expectedWindowVersion: 3, freshAssuranceAt: "2026-09-26T09:00:00.000Z",
    idempotencyKey: id("10"), ...changes };
}
function transactions() {
  return { runPrecheck: vi.fn(), recordDecision: vi.fn(), recordApprovalNotice: vi.fn(), holdApproval: vi.fn(),
    authorizeRelease: vi.fn(), exportAudit: vi.fn() };
}

describe("single-approver review service", () => {
  it("is literal-false and performs no transaction while disabled", async () => {
    expect(CLAIMANT_SINGLE_APPROVER_REVIEW_APPROVED).toBe(false);
    const client = transactions();
    const service = createSingleApproverReviewServiceV1({ transactions: client as never });
    expect(() => service.recordDecision(decision())).toThrow(expect.objectContaining({ kind: "disabled" }));
    expect(() => service.authorizeRelease(release())).toThrow(expect.objectContaining({ kind: "disabled" }));
    expect(Object.values(client).every((mock) => mock.mock.calls.length === 0)).toBe(true);
  });

  it("passes exact input through only when enabled", async () => {
    const client = transactions();
    const service = createSingleApproverReviewServiceV1({ approved: true, transactions: client as never });
    service.recordDecision(decision()); service.authorizeRelease(release());
    service.holdApproval({ caseId: id("01"), reviewRoundId: id("07"), expectedWindowVersion: 2,
      actorClass: "next_of_kin", actorUserId: id("11"), reasonClass: "next_of_kin_dispute", idempotencyKey: id("12") });
    expect(client.recordDecision).toHaveBeenCalledWith(decision());
    expect(client.authorizeRelease).toHaveBeenCalledWith(release());
    expect(client.holdApproval).toHaveBeenCalledOnce();
  });

  it("rejects mismatched reasons, override attempts, actor mix-ups and extra authority", () => {
    const service = createSingleApproverReviewServiceV1({ approved: true, transactions: transactions() as never });
    for (const value of [decision({ reasonClass: "more_information_needed" }), decision({ override: true }),
      decision({ decision: "approve" }), decision({ policyPackId: "real_policy" })])
      expect(() => service.recordDecision(value)).toThrow(expect.objectContaining({ kind: "invalid_input" }));
    for (const value of [{ actorClass: "owner", actorUserId: id("11"), reasonClass: "claimant_dispute" },
      { actorClass: "system", actorUserId: id("11"), reasonClass: "material_change" },
      { actorClass: "claimant", actorUserId: null, reasonClass: "claimant_dispute" }])
      expect(() => service.holdApproval({ caseId: id("01"), reviewRoundId: id("07"), expectedWindowVersion: 2,
        idempotencyKey: id("12"), ...value })).toThrow(expect.objectContaining({ kind: "invalid_input" }));
    for (const value of [release({ freshAssuranceAt: "yesterday" }), release({ releaseAuthorized: true })])
      expect(() => service.authorizeRelease(value)).toThrow(expect.objectContaining({ kind: "invalid_input" }));
    expect(() => service.recordApprovalNotice({ caseId: id("01"), reviewRoundId: id("07"), expectedWindowVersion: 1,
      outcome: "verified", evidenceDigest: null, idempotencyKey: id("13") }))
      .toThrow(expect.objectContaining({ kind: "invalid_input" }));
  });
});

describe("single-approver review transaction client", () => {
  const rpcReturning = (data: unknown, error: { code?: string } | null = null) =>
    vi.fn(async () => ({ data, error }));

  it("parses a clear pre-check and refuses a result whose outcome contradicts its checks", async () => {
    const good = { case_id: id("01"), case_version: 5, cycle_id: id("02"), precheck_id: id("05"),
      phase: "decision", check_set_version: "single_approver_prechecks_v1", outcome: "clear",
      results: { ...checks, round_not_decided: true }, release_authorized: false, replayed: false };
    const client = createSingleApproverReviewTransactionClientV1(rpcReturning(good));
    await expect(client.runPrecheck({ caseId: id("01"), cycleId: id("02"), phase: "decision",
      expectedCaseVersion: 5, idempotencyKey: id("06") })).resolves.toMatchObject({ outcome: "clear" });
    for (const bad of [{ ...good, results: { ...good.results, recipient_keys_current: false } },
      { ...good, results: { ...checks, round_single_approved: true } }, { ...good, cycle_id: id("99") }]) {
      await expect(createSingleApproverReviewTransactionClientV1(rpcReturning(bad)).runPrecheck({ caseId: id("01"),
        cycleId: id("02"), phase: "decision", expectedCaseVersion: 5, idempotencyKey: id("06") })).rejects.toThrow();
    }
  });

  it("binds a decision's status to the request and refuses a window on a non-approval", async () => {
    const approved = { case_id: id("01"), case_version: 5, cycle_id: id("02"), review_round_id: id("07"),
      round_version: 2, review_mode: "single_approver", review_status: "single_approved",
      dispute_window_status: "awaiting_notice", release_authorized: false, replayed: false };
    await expect(createSingleApproverReviewTransactionClientV1(rpcReturning(approved)).recordDecision(
      decision() as never)).resolves.toMatchObject({ reviewStatus: "single_approved" });
    await expect(createSingleApproverReviewTransactionClientV1(rpcReturning({ ...approved, review_status: "held" }))
      .recordDecision(decision() as never)).rejects.toThrow();
    await expect(createSingleApproverReviewTransactionClientV1(rpcReturning({ ...approved,
      review_status: "held", dispute_window_status: "awaiting_notice" })).recordDecision(decision({ decision: "hold",
      reasonClass: "more_information_needed" }) as never)).rejects.toThrow();
  });

  it("accepts only a single-approver release that stops at authorization", async () => {
    const released = { case_id: id("01"), case_version: 6, case_state: "approved", cycle_id: id("02"),
      review_round_id: id("07"), release_authorization_id: id("14"), release_status: "authorized",
      review_mode: "single_approver", release_authorized: true, package_creation_authorized: false,
      retrieval_authorized: false, replayed: false };
    await expect(createSingleApproverReviewTransactionClientV1(rpcReturning(released)).authorizeRelease(
      release() as never)).resolves.toMatchObject({ reviewMode: "single_approver", packageCreationAuthorized: false });
    for (const bad of [{ ...released, review_mode: "two_person" }, { ...released, retrieval_authorized: true },
      { ...released, case_version: 7 }])
      await expect(createSingleApproverReviewTransactionClientV1(rpcReturning(bad)).authorizeRelease(
        release() as never)).rejects.toThrow();
    await expect(createSingleApproverReviewTransactionClientV1(rpcReturning(null, { code: "42501" }))
      .authorizeRelease(release() as never)).rejects.toBeInstanceOf(SingleApproverReviewTransactionError);
  });

  it("exports a value-free, gap-free audit trail", async () => {
    const entry = (sequence: number) => ({ sequence, step: "single_approval", event_type: "review_precheck_recorded",
      occurred_at: "2026-09-26T09:00:00+00:00", entry_hash: hex(String(sequence)) });
    await expect(createSingleApproverReviewTransactionClientV1(rpcReturning({ case_id: id("01"), verified: true,
      entries: [entry(1), entry(2)] })).exportAudit(id("01"))).resolves.toMatchObject({ verified: true });
    for (const entries of [[entry(1), entry(3)], [{ ...entry(1), reason_class: "requirements_satisfied" }]])
      await expect(createSingleApproverReviewTransactionClientV1(rpcReturning({ case_id: id("01"), verified: true,
        entries })).exportAudit(id("01"))).rejects.toThrow();
  });
});
