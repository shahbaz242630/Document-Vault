import { getVaultCategoryConfig } from "./vault-category-config";
import type { VaultDecryptedAsset } from "./vault-store";

type AssetType = VaultDecryptedAsset["assetType"];

type VaultDashboardCategory = {
  assetType: AssetType;
  count: number;
  label: string;
  routeHref: `/vault/${string}`;
};

type VaultDashboardItem = {
  assetTypeLabel: string;
  id: string;
  title: string;
};

export type VaultCoverageGroup = {
  assetTypes: AssetType[];
  count: number;
  id: "financial" | "property" | "people" | "digital";
  isCovered: boolean;
  label: string;
};

export type VaultDashboardViewModel = {
  activeCount: number;
  categories: VaultDashboardCategory[];
  coverageCount: number;
  coverageGroups: VaultCoverageGroup[];
  coveragePercent: number;
  hasAssets: boolean;
  items: VaultDashboardItem[];
  nextSuggestedGroup: VaultCoverageGroup | null;
};

const coverageDefinitions: (
  Pick<VaultCoverageGroup, "assetTypes" | "id" | "label">
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
    label: "Property",
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

export function createVaultDashboardViewModel(
  assets: VaultDecryptedAsset[],
): VaultDashboardViewModel {
  const categories = new Map<AssetType, VaultDashboardCategory>();

  for (const asset of assets) {
    const existingCategory = categories.get(asset.assetType);

    if (existingCategory) {
      existingCategory.count += 1;
      continue;
    }

    const config = getVaultCategoryConfig(asset.assetType);

    categories.set(asset.assetType, {
      assetType: asset.assetType,
      count: 1,
      label: config.title,
      routeHref: config.routeHref,
    });
  }

  const coverageGroups = coverageDefinitions.map((definition) => {
    const count = assets.filter((asset) =>
      definition.assetTypes.includes(asset.assetType),
    ).length;

    return {
      ...definition,
      count,
      isCovered: count > 0,
    };
  });
  const coverageCount = coverageGroups.filter((group) => group.isCovered).length;

  return {
    activeCount: assets.length,
    categories: Array.from(categories.values()),
    coverageCount,
    coverageGroups,
    coveragePercent: Math.round((coverageCount / coverageGroups.length) * 100),
    hasAssets: assets.length > 0,
    items: [...assets]
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((asset) => ({
        assetTypeLabel: getVaultCategoryConfig(asset.assetType).itemLabel,
        id: asset.id,
        title: asset.title,
      })),
    nextSuggestedGroup:
      coverageGroups.find((group) => !group.isCovered) ?? null,
  };
}
