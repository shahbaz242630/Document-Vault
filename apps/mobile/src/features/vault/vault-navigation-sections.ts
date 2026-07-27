import {
  vaultCategoryConfigs,
  type VaultCategoryConfig,
} from "./vault-category-config";

export type VaultCoverageSection = {
  categories: VaultCategoryConfig[];
  id: "financial" | "property" | "people" | "digital";
  label: string;
};

const sectionDefinitions: (
  Omit<VaultCoverageSection, "categories"> & {
    assetTypes: VaultCategoryConfig["assetType"][];
  }
)[] = [
  {
    assetTypes: [
      "bank_account",
      "card",
      "crypto",
      "insurance",
      "investment",
      "loan_debt",
      "pension",
    ],
    id: "financial",
    label: "Financial",
  },
  {
    assetTypes: ["property", "vehicle", "business_interest"],
    id: "property",
    label: "Property & possessions",
  },
  {
    assetTypes: ["contact", "dependent_pet", "medical_care"],
    id: "people",
    label: "People & care",
  },
  {
    assetTypes: [
      "digital_account",
      "document_location",
      "subscription",
      "other",
    ],
    id: "digital",
    label: "Digital & admin",
  },
];

export function getVaultCoverageSections(): VaultCoverageSection[] {
  return sectionDefinitions.map((section) => ({
    categories: section.assetTypes.map((assetType) => {
      const category = vaultCategoryConfigs.find(
        (candidate) => candidate.assetType === assetType,
      );
      if (!category) {
        throw new Error(`Missing vault category: ${assetType}`);
      }
      return category;
    }),
    id: section.id,
    label: section.label,
  }));
}
