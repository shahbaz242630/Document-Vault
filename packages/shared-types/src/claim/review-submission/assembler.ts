import { syntheticReviewSubmissionDeclarationKeys } from "./declarations";
import type {
  SyntheticReviewSubmissionAssemblyInputV1,
  SyntheticReviewSubmissionAssemblyResultV1,
  SyntheticReviewSubmissionEnvelopeV1,
} from "./contracts";
import { validateSyntheticReviewSubmission } from "./validation";

export function assembleSyntheticReviewSubmission(
  input: SyntheticReviewSubmissionAssemblyInputV1,
): SyntheticReviewSubmissionAssemblyResultV1 {
  const validation = validateSyntheticReviewSubmission(input);
  if (!validation.valid) {
    return { status: "rejected", envelope: null, issues: validation.issues };
  }

  const envelope: SyntheticReviewSubmissionEnvelopeV1 = {
    protocol: "sanduqkin:claim:review-submission-envelope:v1",
    synthetic_only: true,
    production_approved: false,
    runtime_submission_authorized: false,
    release_authorized: false,
    status: "assembled_for_review_submission",
    submission_ref: input.draft.submission_ref,
    idempotency_key: input.draft.idempotency_key,
    case_ref: input.draft.case_ref,
    expected_case_version: input.draft.expected_case_version,
    policy_id: input.preparation.policy_id!,
    policy_version: input.preparation.policy_version!,
    evidence_bundle_ref: input.bundle.bundle_ref,
    evidence_manifest: input.preparation.items.map(({ key, placeholder_ref }) => ({
      item_key: key,
      placeholder_ref: placeholder_ref!,
    })),
    declarations: [...syntheticReviewSubmissionDeclarationKeys],
    created_at: input.draft.created_at,
  };
  return { status: "assembled", envelope, issues: [] };
}
