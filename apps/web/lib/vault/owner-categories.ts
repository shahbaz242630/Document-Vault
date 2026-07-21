import { schemaDrivenVaultCategories } from "@vault/shared-validation";

export const ownerVaultAssetTypes = [
  ...schemaDrivenVaultCategories.map((definition) => definition.assetType),
] as const;

export type OwnerVaultAssetType = (typeof ownerVaultAssetTypes)[number];

export function isOwnerVaultAssetType(value: string | undefined): value is OwnerVaultAssetType {
  return Boolean(value && ownerVaultAssetTypes.includes(value as OwnerVaultAssetType));
}
