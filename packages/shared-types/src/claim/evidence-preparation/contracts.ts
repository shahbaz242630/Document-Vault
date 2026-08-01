import type {
  ClaimantChecklistItemKey,
  SyntheticChecklistItemAvailability,
  SyntheticRenderedChecklistItemV1,
} from "../checklist/contracts";

export const syntheticEvidenceMediaTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type SyntheticEvidenceMediaType =
  (typeof syntheticEvidenceMediaTypes)[number];

export type SyntheticEvidencePlaceholderV1 = {
  protocol: "sanduqkin:claim:evidence-placeholder:v1";
  synthetic_only: true;
  placeholder_ref: string;
  checklist_item_key: ClaimantChecklistItemKey;
  display_label: string;
  media_type: SyntheticEvidenceMediaType;
  size_bytes: number;
  prepared_at: string;
};

export type SyntheticEvidenceBundleV1 = {
  protocol: "sanduqkin:claim:evidence-bundle:v1";
  synthetic_only: true;
  production_approved: false;
  bundle_ref: string;
  policy_id: string;
  policy_version: number;
  placeholders: readonly SyntheticEvidencePlaceholderV1[];
  unavailable_items: readonly ClaimantChecklistItemKey[];
};

export type SyntheticEvidencePreparationIssueCode =
  | "checklist_unavailable"
  | "invalid_bundle"
  | "policy_binding_mismatch"
  | "unexpected_item"
  | "duplicate_item"
  | "duplicate_placeholder_ref"
  | "invalid_placeholder"
  | "invalid_display_label"
  | "unsupported_media_type"
  | "invalid_size"
  | "invalid_prepared_at"
  | "prepared_in_future"
  | "document_unavailable";

export type SyntheticEvidencePreparationIssueV1 = {
  code: SyntheticEvidencePreparationIssueCode;
  item_key: ClaimantChecklistItemKey | null;
  placeholder_ref: string | null;
};

export type SyntheticEvidenceValidationV1 = {
  accepted_placeholders: readonly SyntheticEvidencePlaceholderV1[];
  issues: readonly SyntheticEvidencePreparationIssueV1[];
};

export type SyntheticPreparedEvidenceItemV1 = Pick<
  SyntheticRenderedChecklistItemV1,
  "key" | "label" | "explanation" | "category" | "source"
> & {
  availability: SyntheticChecklistItemAvailability;
  placeholder_ref: string | null;
};

export type SyntheticEvidencePreparationV1 = {
  protocol: "sanduqkin:claim:evidence-preparation:v1";
  synthetic_only: true;
  release_authorized: false;
  status: "documents_needed" | "ready_for_review" | "manual_review";
  manual_review_reason:
    | "checklist_unavailable"
    | "binding_mismatch"
    | "invalid_metadata"
    | "document_unavailable"
    | null;
  policy_id: string | null;
  policy_version: number | null;
  items: readonly SyntheticPreparedEvidenceItemV1[];
  issues: readonly SyntheticEvidencePreparationIssueV1[];
};
