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

export type VaultDashboardViewModel = {
  activeCount: number;
  categories: VaultDashboardCategory[];
  hasAssets: boolean;
  items: VaultDashboardItem[];
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

    const config = getVaultCategoryConfig(asset.assetType);

    categories.set(asset.assetType, {
      assetType: asset.assetType,
      count: 1,
      label: config.title,
      routeHref: config.routeHref,
    });
  }

  return {
    activeCount: assets.length,
    categories: Array.from(categories.values()),
    hasAssets: assets.length > 0,
    items: [...assets]
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((asset) => ({
        assetTypeLabel: getVaultCategoryConfig(asset.assetType).itemLabel,
        id: asset.id,
        title: asset.title,
      })),
  };
}
