import { describe, expect, it } from "vitest";

import {
  assembleSyntheticReviewSubmission,
  createSyntheticReviewSubmissionDraft,
  createSyntheticReviewSubmissionInput,
  syntheticReviewSubmissionDeclarationKeys,
  syntheticReviewSubmissionPreparation,
} from "./index";

describe("synthetic review submission assembly", () => {
  it("assembles an immutable-shape review envelope without runtime or release authority", () => {
    const result = assembleSyntheticReviewSubmission(
      createSyntheticReviewSubmissionInput(),
    );

    expect(result.status).toBe("assembled");
    if (result.status !== "assembled") throw new Error("Expected assembled fixture.");
    expect(result.envelope).toMatchObject({
      protocol: "sanduqkin:claim:review-submission-envelope:v1",
      synthetic_only: true,
      production_approved: false,
      runtime_submission_authorized: false,
      release_authorized: false,
      status: "assembled_for_review_submission",
      declarations: syntheticReviewSubmissionDeclarationKeys,
    });
    expect(result.envelope.evidence_manifest).toHaveLength(
      syntheticReviewSubmissionPreparation.items.length,
    );
    expect(
      result.envelope.evidence_manifest.every(
        ({ item_key, placeholder_ref }) =>
          item_key.length > 0 && placeholder_ref.startsWith("synthetic_evidence_"),
      ),
    ).toBe(true);
  });

  it("binds the policy, evidence bundle, case version, and idempotency identity", () => {
    const input = createSyntheticReviewSubmissionInput();
    const result = assembleSyntheticReviewSubmission(input);

    expect(result.status).toBe("assembled");
    if (result.status !== "assembled") throw new Error("Expected assembled fixture.");
    expect(result.envelope).toMatchObject({
      submission_ref: input.draft.submission_ref,
      idempotency_key: input.draft.idempotency_key,
      case_ref: input.draft.case_ref,
      expected_case_version: input.current_case_version,
      policy_id: input.preparation.policy_id,
      policy_version: input.preparation.policy_version,
      evidence_bundle_ref: input.bundle.bundle_ref,
    });
  });

  it("returns no envelope for stale or replayed input", () => {
    const draft = createSyntheticReviewSubmissionDraft();
    const result = assembleSyntheticReviewSubmission(
      createSyntheticReviewSubmissionInput({
        current_case_version: draft.expected_case_version + 1,
        used_idempotency_keys: [draft.idempotency_key],
      }),
    );

    expect(result).toEqual({
      status: "rejected",
      envelope: null,
      issues: ["stale_case_version", "replayed_idempotency_key"],
    });
  });
});
