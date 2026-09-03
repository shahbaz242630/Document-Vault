import { describe, expect, it, vi } from "vitest";

import { ClaimSubmissionTransactionError, createClaimSubmissionTransactionClientV1 }
  from "./claim-submission-transaction-client.js";

const ids = { case: "60000000-0000-4000-8000-000000000001",
  claimant: "60000000-0000-4000-8000-000000000002",
  session: "60000000-0000-4000-8000-000000000003",
  attempt: "60000000-0000-4000-8000-000000000004" };

describe("claim submission transaction client", () => {
  it("maps the exact bounded submission RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result(), error: null });
    await expect(createClaimSubmissionTransactionClientV1(rpc).submit(input()))
      .resolves.toMatchObject({ caseId: ids.case, caseVersion: 3, state: "submitted",
        reviewStarted: false, releaseAuthorized: false });
    expect(rpc).toHaveBeenCalledWith("claimant_submit_claim_for_review", {
      p_bundle_ref: "synthetic_bundle_alpha_001", p_case_id: ids.case,
      p_claimant_user_id: ids.claimant, p_created_at: "2026-08-12T12:00:00.000Z",
      p_declarations: declarations, p_evidence_manifest: [{ item_key: "claimant_photo_identity",
        placeholder_ref: "synthetic_evidence_001" }], p_expected_case_version: 2,
      p_expected_intake_version: 3, p_expected_preparation_version: 2,
      p_idempotency_key: ids.attempt, p_policy_pack_id: "synthetic_policy_death_alpha",
      p_policy_pack_version: 1, p_portal_session_id: ids.session,
      p_submission_ref: "synthetic_submission_alpha_001",
    });
  });

  it("redacts RPC failures and rejects extra result fields", async () => {
    const failed = createClaimSubmissionTransactionClientV1(vi.fn().mockResolvedValue({ data: null,
      error: { code: "42501", message: "private receipt detail" } }));
    const error = await failed.submit(input()).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ClaimSubmissionTransactionError);
    expect(JSON.stringify(error)).not.toContain("private receipt");
    const hostile = createClaimSubmissionTransactionClientV1(vi.fn().mockResolvedValue({ data: {
      ...result(), reviewer_id: "prohibited" }, error: null }));
    await expect(hostile.submit(input())).rejects.toThrow("invalid result");
  });
});

const declarations = ["information_is_accurate", "evidence_is_lawfully_held",
  "known_conflicts_are_disclosed", "review_is_not_release"];
function input() { return { bundleRef: "synthetic_bundle_alpha_001", caseId: ids.case,
  claimantUserId: ids.claimant, createdAt: "2026-08-12T12:00:00.000Z", declarations,
  evidenceManifest: [{ itemKey: "claimant_photo_identity" as const,
    placeholderRef: "synthetic_evidence_001" }], expectedCaseVersion: 2,
  expectedIntakeVersion: 3, expectedPreparationVersion: 2, idempotencyKey: ids.attempt,
  policyPackId: "synthetic_policy_death_alpha", policyPackVersion: 1,
  portalSessionId: ids.session, submissionRef: "synthetic_submission_alpha_001" }; }
function result() { return { acknowledgement_ref: `synthetic_acknowledgement_${"a".repeat(32)}`,
  case_id: ids.case, case_version: 3, intake_version: 3, preparation_version: 2,
  release_authorized: false, replayed: false, review_started: false, state: "submitted",
  status: "received_for_review" }; }
