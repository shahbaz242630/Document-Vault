export const claimantChecklistItemKeys = [
  "claimant_photo_identity",
  "identity_verification_result",
  "owner_match_reference",
  "official_death_record",
  "authority_basis",
  "processing_declaration",
  "conflict_declaration",
  "probate_authority",
  "relationship_evidence",
  "name_variation_evidence",
  "certified_translation",
  "attestation_evidence",
  "dispute_documents",
] as const;

export const claimantChecklistConditionKeys = [
  "probate_required",
  "relationship_evidence_required",
  "name_variation_present",
  "translation_required",
  "attestation_required",
  "dispute_known",
] as const;

export type ClaimantChecklistItemKey =
  (typeof claimantChecklistItemKeys)[number];
export type ClaimantChecklistConditionKey =
  (typeof claimantChecklistConditionKeys)[number];

export type ClaimantChecklistItemDefinition = {
  key: ClaimantChecklistItemKey;
  label: string;
  explanation: string;
  category: "identity" | "owner_reference" | "authority" | "declaration";
};

export type SyntheticChecklistConditionalRuleV1 = {
  when: ClaimantChecklistConditionKey;
  item: ClaimantChecklistItemKey;
};

export type SyntheticChecklistIntegrityV1 = {
  algorithm: "synthetic_fnv1a32_not_cryptographic";
  key_id: string;
  checksum: string;
};

export type SyntheticChecklistPolicyPackV1 = {
  protocol: "sanduqkin:claim:checklist-policy:v1";
  synthetic_only: true;
  production_approved: false;
  policy_id: string;
  policy_version: number;
  jurisdiction_key: string;
  trigger_type: "death";
  effective_at: string;
  review_at: string;
  expires_at: string;
  accountable_approver_ref: string;
  counsel_source_ref: string;
  common_items: readonly ClaimantChecklistItemKey[];
  conditional_rules: readonly SyntheticChecklistConditionalRuleV1[];
  integrity: SyntheticChecklistIntegrityV1;
};

export type SyntheticChecklistPolicyDraftV1 = Omit<
  SyntheticChecklistPolicyPackV1,
  "integrity"
> & {
  integrity: Omit<SyntheticChecklistIntegrityV1, "checksum">;
};

export type SyntheticChecklistRoutingFactsV1 = {
  protocol: "sanduqkin:claim:checklist-routing:v1";
  synthetic_only: true;
  jurisdiction_key: string;
  trigger_type: "death";
  conditions: Readonly<Record<ClaimantChecklistConditionKey, boolean>>;
};

export type SyntheticChecklistPolicySelectionResult =
  | {
      status: "selected";
      pack: SyntheticChecklistPolicyPackV1;
    }
  | {
      status: "manual_review";
      reason:
        | "missing_policy"
        | "conflicting_policy"
        | "invalid_policy"
        | "expired_policy";
    };

export type SyntheticChecklistItemAvailability =
  | "pending"
  | "available"
  | "not_available";

export type SyntheticRenderedChecklistItemV1 = ClaimantChecklistItemDefinition & {
  availability: SyntheticChecklistItemAvailability;
  source: "common" | "conditional";
};

export type SyntheticRenderedChecklistV1 = {
  protocol: "sanduqkin:claim:rendered-checklist:v1";
  synthetic_only: true;
  release_authorized: false;
  status: "documents_needed" | "ready_for_review" | "manual_review";
  manual_review_reason:
    | "missing_policy"
    | "conflicting_policy"
    | "invalid_policy"
    | "expired_policy"
    | "document_unavailable"
    | null;
  policy_id: string | null;
  policy_version: number | null;
  items: readonly SyntheticRenderedChecklistItemV1[];
};
