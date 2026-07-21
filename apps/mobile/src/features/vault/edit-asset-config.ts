import {
  createSchemaDrivenVaultInitialValues,
  createSchemaDrivenVaultPayload,
  getSchemaDrivenVaultCategory,
} from "@vault/shared-validation";

import type { AssetPlaintextPayload, AssetType } from "./asset-payload";
import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createSchemaDrivenVaultFormViewModel } from "./schema-driven-form-view-model";
import type { VaultDecryptedAsset } from "./vault-store";

export type EditAssetConfig = {
  categoryLabel: string;
  fields: DynamicFormField[];
  createPayload: (
    values: Record<string, string>,
    existingFields?: Record<string, string>,
  ) => AssetPlaintextPayload;
  getInitialValues: (asset: VaultDecryptedAsset) => Record<string, string>;
};

export function getEditAssetConfig(assetType: AssetType): EditAssetConfig {
  const definition = getSchemaDrivenVaultCategory(assetType);
  if (!definition) throw new Error(`Missing shared vault category: ${assetType}`);
  const viewModel = createSchemaDrivenVaultFormViewModel(definition);

  return {
    categoryLabel: viewModel.categoryLabel,
    fields: viewModel.fields,
    createPayload: (values, existingFields) =>
      createSchemaDrivenVaultPayload(definition, values, existingFields),
    getInitialValues: (asset) => createSchemaDrivenVaultInitialValues(definition, asset),
  };
}
