import type {
  SyntheticReviewSubmissionAssemblyInputV1,
  SyntheticReviewSubmissionValidationV1,
} from "./contracts";
import { validateSyntheticSubmissionDraft } from "./draft-validation";
import { validateSyntheticSubmissionEvidence } from "./evidence-binding";

export function validateSyntheticReviewSubmission(
  input: SyntheticReviewSubmissionAssemblyInputV1,
): SyntheticReviewSubmissionValidationV1 {
  const issues = [
    ...validateSyntheticSubmissionDraft(input),
    ...validateSyntheticSubmissionEvidence(input),
  ];
  return { valid: issues.length === 0, issues };
}
