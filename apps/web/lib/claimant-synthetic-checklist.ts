import {
  claimantCommonChecklistItemKeys,
  createSyntheticChecklistRoutingFacts,
  renderSyntheticClaimantChecklist,
  syntheticChecklistPolicyPack,
  type ClaimantChecklistItemKey,
  type SyntheticChecklistItemAvailability,
  type SyntheticRenderedChecklistV1,
} from "@vault/shared-types";

export type ClaimantSyntheticChecklistFixture = {
  key: "documents-needed" | "ready-for-review" | "unavailable" | "missing-policy";
  label: string;
  description: string;
  checklist: SyntheticRenderedChecklistV1;
};

const serverTime = "2026-08-01T00:00:00.000Z";
const commonAvailable = availabilityFor(claimantCommonChecklistItemKeys, "available");

export const claimantSyntheticChecklistFixtures: readonly ClaimantSyntheticChecklistFixture[] = [
  {
    key: "documents-needed",
    label: "Documents still needed",
    description: "Shows common items plus one policy-selected conditional requirement.",
    checklist: renderSyntheticClaimantChecklist({
      packs: [syntheticChecklistPolicyPack],
      facts: createSyntheticChecklistRoutingFacts({ probate_required: true }),
      server_time: serverTime,
      availability: {
        claimant_photo_identity: "available",
        identity_verification_result: "available",
      },
    }),
  },
  {
    key: "ready-for-review",
    label: "Ready for controlled review",
    description: "Shows that a complete checklist only enters review; it never authorizes release.",
    checklist: renderSyntheticClaimantChecklist({
      packs: [syntheticChecklistPolicyPack],
      facts: createSyntheticChecklistRoutingFacts({ relationship_evidence_required: true }),
      server_time: serverTime,
      availability: {
        ...commonAvailable,
        relationship_evidence: "available",
      },
    }),
  },
  {
    key: "unavailable",
    label: "Required document unavailable",
    description: "Shows an unavailable policy requirement routing safely to manual review.",
    checklist: renderSyntheticClaimantChecklist({
      packs: [syntheticChecklistPolicyPack],
      facts: createSyntheticChecklistRoutingFacts({ translation_required: true }),
      server_time: serverTime,
      availability: {
        ...commonAvailable,
        certified_translation: "not_available",
      },
    }),
  },
  {
    key: "missing-policy",
    label: "No applicable policy",
    description: "Shows fail-closed routing when no policy pack matches the synthetic facts.",
    checklist: renderSyntheticClaimantChecklist({
      packs: [],
      facts: createSyntheticChecklistRoutingFacts(),
      server_time: serverTime,
    }),
  },
];

function availabilityFor(
  keys: readonly ClaimantChecklistItemKey[],
  availability: SyntheticChecklistItemAvailability,
) {
  return Object.fromEntries(keys.map((key) => [key, availability])) as Partial<
    Record<ClaimantChecklistItemKey, SyntheticChecklistItemAvailability>
  >;
}
