import type { VaultDecryptedAsset } from "./vault-store";

type AssetType = VaultDecryptedAsset["assetType"];

type VaultDashboardCategory = {
  assetType: AssetType;
  count: number;
  label: string;
};

type VaultDashboardItem = {
  assetTypeLabel: string;
  id: string;
  title: string;
};

export type VaultDashboardViewModel = {
  activeCount: number;
  categories: VaultDashboardCategory[];
  hasAssets: boolean;
  items: VaultDashboardItem[];
};

const categoryLabels: Record<AssetType, string> = {
  bank_account: "Bank accounts",
  contact: "Contacts",
  crypto: "Crypto references",
  document_location: "Document locations",
  insurance: "Insurance",
  investment: "Investments",
  other: "Other",
  pension: "Pensions",
  property: "Properties",
  subscription: "Subscriptions",
};

const itemLabels: Record<AssetType, string> = {
  bank_account: "Bank account",
  contact: "Contact",
  crypto: "Crypto reference",
  document_location: "Document location",
  insurance: "Insurance",
  investment: "Investment",
  other: "Other",
  pension: "Pension",
  property: "Property",
  subscription: "Subscription",
};

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

    categories.set(asset.assetType, {
      assetType: asset.assetType,
      count: 1,
      label: categoryLabels[asset.assetType],
    });
  }

  return {
    activeCount: assets.length,
    categories: Array.from(categories.values()),
    hasAssets: assets.length > 0,
    items: [...assets]
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((asset) => ({
        assetTypeLabel: itemLabels[asset.assetType],
        id: asset.id,
        title: asset.title,
      })),
  };
}
