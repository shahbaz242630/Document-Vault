import {
  createSyntheticEvidenceBundle,
  createSyntheticEvidencePlaceholder,
  prepareSyntheticEvidence,
  syntheticEvidenceChecklist,
  syntheticEvidenceServerTime,
} from "../evidence-preparation";
import { syntheticReviewSubmissionDeclarationKeys } from "./declarations";
import type {
  SyntheticReviewSubmissionAssemblyInputV1,
  SyntheticReviewSubmissionDraftV1,
} from "./contracts";

const placeholders = syntheticEvidenceChecklist.items.map(({ key }, index) =>
  createSyntheticEvidencePlaceholder(key, index + 1),
);

export const syntheticReviewSubmissionBundle = createSyntheticEvidenceBundle({
  placeholders,
});

export const syntheticReviewSubmissionPreparation = prepareSyntheticEvidence({
  bundle: syntheticReviewSubmissionBundle,
  checklist: syntheticEvidenceChecklist,
  server_time: syntheticEvidenceServerTime,
});

export function createSyntheticReviewSubmissionDraft(): SyntheticReviewSubmissionDraftV1 {
  return {
    protocol: "sanduqkin:claim:review-submission-draft:v1",
    synthetic_only: true,
    production_approved: false,
    submission_ref: "synthetic_submission_alpha_001",
    idempotency_key: "synthetic_idempotency_submission_001",
    case_ref: "synthetic_case_alpha_001",
    expected_case_version: 4,
    created_at: "2026-08-01T00:00:00.000Z",
    declarations: Object.fromEntries(
      syntheticReviewSubmissionDeclarationKeys.map((key) => [key, true]),
    ) as SyntheticReviewSubmissionDraftV1["declarations"],
  };
}

export function createSyntheticReviewSubmissionInput(
  overrides: Partial<SyntheticReviewSubmissionAssemblyInputV1> = {},
): SyntheticReviewSubmissionAssemblyInputV1 {
  return {
    draft: createSyntheticReviewSubmissionDraft(),
    checklist: syntheticEvidenceChecklist,
    bundle: syntheticReviewSubmissionBundle,
    preparation: syntheticReviewSubmissionPreparation,
    current_case_version: 4,
    used_submission_refs: [],
    used_idempotency_keys: [],
    server_time: syntheticEvidenceServerTime,
    ...overrides,
  };
}
