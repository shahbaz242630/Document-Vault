import {
  createSyntheticEvidenceBundle,
  createSyntheticEvidencePlaceholder,
  prepareSyntheticEvidence,
  syntheticEvidenceChecklist,
  syntheticEvidenceServerTime,
  type SyntheticEvidencePreparationV1,
} from "@vault/shared-types";

export type ClaimantSyntheticEvidenceFixture = {
  key: "partially-prepared" | "ready-for-review" | "unavailable" | "invalid-metadata";
  label: string;
  description: string;
  preparation: SyntheticEvidencePreparationV1;
};

const allPlaceholders = syntheticEvidenceChecklist.items.map(({ key }, index) =>
  createSyntheticEvidencePlaceholder(key, index + 1),
);
const invalidPlaceholder = {
  ...createSyntheticEvidencePlaceholder(syntheticEvidenceChecklist.items[0]!.key, 1),
  display_label: "invalid placeholder label",
};

export const claimantSyntheticEvidenceFixtures: readonly ClaimantSyntheticEvidenceFixture[] = [
  fixture(
    "partially-prepared",
    "Evidence preparation in progress",
    "Shows two synthetic placeholders prepared while the remaining requirements stay pending.",
    createSyntheticEvidenceBundle({ placeholders: allPlaceholders.slice(0, 2) }),
  ),
  fixture(
    "ready-for-review",
    "Prepared for controlled review",
    "Shows a complete synthetic bundle reaching review readiness without authorizing release.",
    createSyntheticEvidenceBundle({ placeholders: allPlaceholders }),
  ),
  fixture(
    "unavailable",
    "Required evidence unavailable",
    "Shows a declared unavailable requirement routing safely to manual review.",
    createSyntheticEvidenceBundle({
      unavailable_items: [syntheticEvidenceChecklist.items[2]!.key],
    }),
  ),
  fixture(
    "invalid-metadata",
    "Placeholder metadata rejected",
    "Shows malformed synthetic metadata failing closed without accepting any placeholder.",
    createSyntheticEvidenceBundle({ placeholders: [invalidPlaceholder] }),
  ),
];

function fixture(
  key: ClaimantSyntheticEvidenceFixture["key"],
  label: string,
  description: string,
  bundle: Parameters<typeof prepareSyntheticEvidence>[0]["bundle"],
): ClaimantSyntheticEvidenceFixture {
  return {
    key,
    label,
    description,
    preparation: prepareSyntheticEvidence({
      bundle,
      checklist: syntheticEvidenceChecklist,
      server_time: syntheticEvidenceServerTime,
    }),
  };
}
