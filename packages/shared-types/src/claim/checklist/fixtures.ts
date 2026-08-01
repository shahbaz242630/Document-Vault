import { claimantCommonChecklistItemKeys } from "./catalogue";
import type {
  ClaimantChecklistConditionKey,
  SyntheticChecklistPolicyDraftV1,
  SyntheticChecklistRoutingFactsV1,
} from "./contracts";
import { createSyntheticChecklistPolicyPack } from "./synthetic-integrity";

const defaultConditions = {
  probate_required: false,
  relationship_evidence_required: false,
  name_variation_present: false,
  translation_required: false,
  attestation_required: false,
  dispute_known: false,
} as const satisfies Record<ClaimantChecklistConditionKey, boolean>;

export const syntheticChecklistPolicyDraft: SyntheticChecklistPolicyDraftV1 = {
  protocol: "sanduqkin:claim:checklist-policy:v1",
  synthetic_only: true,
  production_approved: false,
  policy_id: "synthetic_policy_death_alpha",
  policy_version: 1,
  jurisdiction_key: "synthetic_jurisdiction_alpha",
  trigger_type: "death",
  effective_at: "2026-01-01T00:00:00.000Z",
  review_at: "2026-09-01T00:00:00.000Z",
  expires_at: "2027-01-01T00:00:00.000Z",
  accountable_approver_ref: "synthetic_approver_legal_001",
  counsel_source_ref: "synthetic_source_policy_001",
  common_items: claimantCommonChecklistItemKeys,
  conditional_rules: [
    { when: "probate_required", item: "probate_authority" },
    { when: "relationship_evidence_required", item: "relationship_evidence" },
    { when: "name_variation_present", item: "name_variation_evidence" },
    { when: "translation_required", item: "certified_translation" },
    { when: "attestation_required", item: "attestation_evidence" },
    { when: "dispute_known", item: "dispute_documents" },
  ],
  integrity: {
    algorithm: "synthetic_fnv1a32_not_cryptographic",
    key_id: "synthetic_key_policy_001",
  },
};

export const syntheticChecklistPolicyPack =
  createSyntheticChecklistPolicyPack(syntheticChecklistPolicyDraft);

export function createSyntheticChecklistRoutingFacts(
  conditions: Partial<Record<ClaimantChecklistConditionKey, boolean>> = {},
): SyntheticChecklistRoutingFactsV1 {
  return {
    protocol: "sanduqkin:claim:checklist-routing:v1",
    synthetic_only: true,
    jurisdiction_key: "synthetic_jurisdiction_alpha",
    trigger_type: "death",
    conditions: { ...defaultConditions, ...conditions },
  };
}
