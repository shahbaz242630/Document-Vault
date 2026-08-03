import type {
  ClaimantChecklistItemDefinition,
  ClaimantChecklistItemKey,
} from "./contracts";

export const claimantCommonChecklistItemKeys = [
  "claimant_photo_identity",
  "identity_verification_result",
  "owner_match_reference",
  "official_death_record",
  "authority_basis",
  "processing_declaration",
  "conflict_declaration",
] as const satisfies readonly ClaimantChecklistItemKey[];

export const claimantChecklistCatalogue = {
  claimant_photo_identity: {
    key: "claimant_photo_identity",
    label: "Current photo identity document",
    explanation:
      "Used to verify the identity of the person submitting the application; it does not establish release authority.",
    category: "identity",
  },
  identity_verification_result: {
    key: "identity_verification_result",
    label: "Identity verification result",
    explanation:
      "Confirms that the approved identity-verification step completed separately from entitlement review.",
    category: "identity",
  },
  owner_match_reference: {
    key: "owner_match_reference",
    label: "Minimum owner reference",
    explanation:
      "Provides only the approved matching facts needed to route the case without exposing vault contents.",
    category: "owner_reference",
  },
  official_death_record: {
    key: "official_death_record",
    label: "Official death record",
    explanation:
      "Supports the claimed event under the selected policy; the document alone never authorizes release.",
    category: "owner_reference",
  },
  authority_basis: {
    key: "authority_basis",
    label: "Authority or relationship basis",
    explanation:
      "Shows the policy basis the claimant asks reviewers to assess; registration or possession is not enough.",
    category: "authority",
  },
  processing_declaration: {
    key: "processing_declaration",
    label: "Evidence processing declaration",
    explanation:
      "Records the synthetic acknowledgement that submitted materials were lawfully obtained and may be reviewed.",
    category: "declaration",
  },
  conflict_declaration: {
    key: "conflict_declaration",
    label: "Conflict and dispute declaration",
    explanation:
      "Identifies known disputes or competing authority so uncertainty can be routed to manual review.",
    category: "declaration",
  },
  probate_authority: {
    key: "probate_authority",
    label: "Probate or equivalent authority",
    explanation:
      "Requested only when the synthetic policy requires formal authority evidence for review.",
    category: "authority",
  },
  relationship_evidence: {
    key: "relationship_evidence",
    label: "Relationship evidence",
    explanation:
      "Requested only when the synthetic policy makes the claimed relationship relevant to review.",
    category: "authority",
  },
  name_variation_evidence: {
    key: "name_variation_evidence",
    label: "Name variation evidence",
    explanation:
      "Requested only when required records use different names and the variation must be reviewed.",
    category: "identity",
  },
  certified_translation: {
    key: "certified_translation",
    label: "Certified translation",
    explanation:
      "Requested only when the synthetic policy requires an approved translation for review.",
    category: "authority",
  },
  attestation_evidence: {
    key: "attestation_evidence",
    label: "Attestation or legalization evidence",
    explanation:
      "Requested only when the synthetic policy requires an additional authenticity formality.",
    category: "authority",
  },
  dispute_documents: {
    key: "dispute_documents",
    label: "Dispute or competing-authority documents",
    explanation:
      "Routes a known dispute for controlled manual review; it cannot trigger automatic release or rejection.",
    category: "authority",
  },
} as const satisfies Record<
  ClaimantChecklistItemKey,
  ClaimantChecklistItemDefinition
>;
