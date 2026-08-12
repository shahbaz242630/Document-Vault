import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_SUBMISSION_APPROVED, ClaimSubmissionServiceError,
  createClaimSubmissionServiceV1 } from "./claim-submission-service.js";

const ids = { case: "60000000-0000-4000-8000-000000000001",
  claimant: "60000000-0000-4000-8000-000000000002",
  session: "60000000-0000-4000-8000-000000000003",
  attempt: "60000000-0000-4000-8000-000000000004" };

describe("hard-disabled claim submission service", () => {
  it("fails disabled before time or transaction work", async () => {
    expect(CLAIMANT_SUBMISSION_APPROVED).toBe(false);
    const serverTime = vi.fn(); const submit = vi.fn();
    await expect(createClaimSubmissionServiceV1({ serverTime, transactions: { submit } })
      .submit(context())).rejects.toMatchObject({ kind: "disabled" });
    expect(serverTime).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled();
  });

  it("passes only the strict synthetic envelope authority into one transaction", async () => {
    const submit = vi.fn().mockResolvedValue({ state: "submitted" });
    const result = await createClaimSubmissionServiceV1({ approved: true,
      serverTime: () => "2026-08-12T12:01:00.000Z", transactions: { submit } as never })
      .submit(context());
    expect(result).toEqual({ state: "submitted" });
    expect(submit).toHaveBeenCalledWith({ bundleRef: "synthetic_bundle_alpha_001",
      caseId: ids.case, claimantUserId: ids.claimant, createdAt: "2026-08-12T12:00:00.000Z",
      declarations, evidenceManifest: [{ itemKey: "claimant_photo_identity",
        placeholderRef: "synthetic_evidence_001" }], expectedCaseVersion: 2,
      expectedIntakeVersion: 3, expectedPreparationVersion: 2, idempotencyKey: ids.attempt,
      policyPackId: "synthetic_policy_death_alpha", policyPackVersion: 1,
      portalSessionId: ids.session, submissionRef: "synthetic_submission_alpha_001" });
  });

  it("rejects duplicate manifest authority and incomplete or duplicate declarations", async () => {
    const service = enabledService(); const envelope = validEnvelope();
    for (const changed of [
      { ...envelope, evidence_manifest: [...envelope.evidence_manifest,
        { ...envelope.evidence_manifest[0] }] },
      { ...envelope, declarations: declarations.slice(1) },
      { ...envelope, declarations: [declarations[0], declarations[0], ...declarations.slice(2)] },
    ]) await expect(service.submit(context(changed))).rejects.toMatchObject({ kind: "invalid_submission" });
  });

  it("rejects future, mutable-runtime, extra-field, and malformed binding claims", async () => {
    const envelope = validEnvelope(); const service = enabledService();
    for (const changed of [
      { ...envelope, created_at: "2026-08-12T12:02:00.000Z" },
      { ...envelope, runtime_submission_authorized: true },
      { ...envelope, reviewer_id: "private" },
      { ...envelope, case_ref: "not-a-case" },
    ]) await expect(service.submit(context(changed))).rejects.toBeInstanceOf(ClaimSubmissionServiceError);
  });
});

const declarations = ["information_is_accurate", "evidence_is_lawfully_held",
  "known_conflicts_are_disclosed", "review_is_not_release"] as const;
function validEnvelope() { return { protocol: "sanduqkin:claim:review-submission-envelope:v1",
  synthetic_only: true, production_approved: false, runtime_submission_authorized: false,
  release_authorized: false, status: "assembled_for_review_submission",
  submission_ref: "synthetic_submission_alpha_001", idempotency_key: ids.attempt,
  case_ref: ids.case, expected_case_version: 2, policy_id: "synthetic_policy_death_alpha",
  policy_version: 1, evidence_bundle_ref: "synthetic_bundle_alpha_001",
  evidence_manifest: [{ item_key: "claimant_photo_identity", placeholder_ref: "synthetic_evidence_001" }],
  declarations: [...declarations], created_at: "2026-08-12T12:00:00.000Z" }; }
function context(envelope: unknown = validEnvelope()) { return { claimantUserId: ids.claimant,
  envelope, expectedIntakeVersion: 3, expectedPreparationVersion: 2,
  portalSessionId: ids.session }; }
function enabledService() { return createClaimSubmissionServiceV1({ approved: true,
  serverTime: () => "2026-08-12T12:01:00.000Z", transactions: { submit: vi.fn() } }); }
