import type {
  ClaimantChecklistItemKey,
  SyntheticRenderedChecklistV1,
} from "../checklist/contracts";
import type {
  SyntheticEvidenceBundleV1,
  SyntheticEvidencePreparationV1,
} from "../evidence-preparation/contracts";
import type { syntheticReviewSubmissionDeclarationKeys } from "./declarations";

export type SyntheticReviewSubmissionDeclarationKey =
  (typeof syntheticReviewSubmissionDeclarationKeys)[number];

export type SyntheticReviewSubmissionDraftV1 = {
  protocol: "sanduqkin:claim:review-submission-draft:v1";
  synthetic_only: true;
  production_approved: false;
  submission_ref: string;
  idempotency_key: string;
  case_ref: string;
  expected_case_version: number;
  created_at: string;
  declarations: Readonly<Record<SyntheticReviewSubmissionDeclarationKey, boolean>>;
};

export type SyntheticReviewSubmissionManifestItemV1 = {
  item_key: ClaimantChecklistItemKey;
  placeholder_ref: string;
};

export type SyntheticReviewSubmissionEnvelopeV1 = {
  protocol: "sanduqkin:claim:review-submission-envelope:v1";
  synthetic_only: true;
  production_approved: false;
  runtime_submission_authorized: false;
  release_authorized: false;
  status: "assembled_for_review_submission";
  submission_ref: string;
  idempotency_key: string;
  case_ref: string;
  expected_case_version: number;
  policy_id: string;
  policy_version: number;
  evidence_bundle_ref: string;
  evidence_manifest: readonly SyntheticReviewSubmissionManifestItemV1[];
  declarations: readonly SyntheticReviewSubmissionDeclarationKey[];
  created_at: string;
};

export type SyntheticReviewSubmissionIssueCode =
  | "invalid_draft"
  | "invalid_created_at"
  | "created_in_future"
  | "incomplete_declarations"
  | "stale_case_version"
  | "replayed_submission_ref"
  | "replayed_idempotency_key"
  | "evidence_not_ready"
  | "evidence_binding_mismatch";

export type SyntheticReviewSubmissionValidationV1 = {
  valid: boolean;
  issues: readonly SyntheticReviewSubmissionIssueCode[];
};

export type SyntheticReviewSubmissionAssemblyInputV1 = {
  draft: SyntheticReviewSubmissionDraftV1;
  checklist: SyntheticRenderedChecklistV1;
  bundle: SyntheticEvidenceBundleV1;
  preparation: SyntheticEvidencePreparationV1;
  current_case_version: number;
  used_submission_refs: readonly string[];
  used_idempotency_keys: readonly string[];
  server_time: string;
};

export type SyntheticReviewSubmissionAssemblyResultV1 =
  | {
      status: "assembled";
      envelope: SyntheticReviewSubmissionEnvelopeV1;
      issues: readonly [];
    }
  | {
      status: "rejected";
      envelope: null;
      issues: readonly SyntheticReviewSubmissionIssueCode[];
    };
