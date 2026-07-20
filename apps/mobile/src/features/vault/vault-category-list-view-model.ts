import {
  formatSchemaDrivenVaultSummary,
  getSchemaDrivenVaultCategory,
} from "@vault/shared-validation";

import type { VaultDecryptedAsset } from "./vault-store";

type AssetType = VaultDecryptedAsset["assetType"];

export type VaultCategoryListItem = {
  id: string;
  summary: string;
  title: string;
  updatedAt?: string;
};

export type VaultCategoryListViewModel = {
  addHref: `/vault/add-${string}`;
  addLabel: string;
  assetType: AssetType;
  canAddMore: boolean;
  count: number;
  emptyTitle: string;
  items: VaultCategoryListItem[];
  limit: number;
  title: string;
};

type CreateVaultCategoryListViewModelInput = {
  addHref: `/vault/add-${string}`;
  addLabel: string;
  assets: VaultDecryptedAsset[];
  assetType: AssetType;
  emptyTitle: string;
  limit?: number;
  title: string;
};

export function createVaultCategoryListViewModel({
  addHref,
  addLabel,
  assets,
  assetType,
  emptyTitle,
  limit = 20,
  title,
}: CreateVaultCategoryListViewModelInput): VaultCategoryListViewModel {
  const items = assets
    .filter((asset) => asset.assetType === assetType)
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((asset) => ({
      id: asset.id,
      summary: createAssetSummary(asset),
      title: asset.title,
    }));

  return {
    addHref,
    addLabel,
    assetType,
    canAddMore: items.length < limit,
    count: items.length,
    emptyTitle,
    items,
    limit,
    title,
  };
}

function createAssetSummary(asset: VaultDecryptedAsset): string {
  const definition = getSchemaDrivenVaultCategory(asset.assetType);
  return definition ? formatSchemaDrivenVaultSummary(definition, asset.fields, " - ") : "";
}
