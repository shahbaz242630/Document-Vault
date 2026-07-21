import {
  createSchemaDrivenVaultPayload,
  getSchemaDrivenVaultCategory,
} from "@vault/shared-validation";

import type { AssetPlaintextPayload, AssetType } from "./asset-payload";
import { createSchemaDrivenVaultFormViewModel } from "./schema-driven-form-view-model";

export type ExpandedAssetType = Extract<
  AssetType,
  | "business_interest"
  | "card"
  | "dependent_pet"
  | "digital_account"
  | "loan_debt"
  | "medical_care"
  | "vehicle"
>;

export function createExpandedAssetPayload({
  assetType,
  values,
}: {
  assetType: ExpandedAssetType;
  values: Record<string, string>;
}): AssetPlaintextPayload {
  const definition = getSchemaDrivenVaultCategory(assetType);
  if (!definition) throw new Error(`Missing shared vault category: ${assetType}`);
  return createSchemaDrivenVaultPayload(definition, values);
}

export function getExpandedAssetConfig(assetType: ExpandedAssetType) {
  const definition = getSchemaDrivenVaultCategory(assetType);
  if (!definition) throw new Error(`Missing shared vault category: ${assetType}`);
  return createSchemaDrivenVaultFormViewModel(definition);
}
