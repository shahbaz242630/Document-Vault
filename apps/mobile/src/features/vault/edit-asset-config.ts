import type { AssetPlaintextPayload, AssetType } from "./asset-payload";
import type { DynamicFormField } from "./components/dynamic-asset-form";
import {
  createBankAccountEditConfig,
  createContactEditConfig,
  createCryptoEditConfig,
  createDocumentLocationEditConfig,
  createInsuranceEditConfig,
  createInvestmentEditConfig,
  createOtherEditConfig,
  createPensionEditConfig,
  createPropertyEditConfig,
  createSubscriptionEditConfig,
} from "./edit-asset-config-builders";
import type { VaultDecryptedAsset } from "./vault-store";

export type EditAssetConfig = {
  categoryLabel: string;
  fields: DynamicFormField[];
  createPayload: (values: Record<string, string>) => AssetPlaintextPayload;
  getInitialValues: (asset: VaultDecryptedAsset) => Record<string, string>;
};

const editAssetConfigFactories: Record<AssetType, () => EditAssetConfig> = {
  bank_account: createBankAccountEditConfig,
  contact: createContactEditConfig,
  crypto: createCryptoEditConfig,
  document_location: createDocumentLocationEditConfig,
  insurance: createInsuranceEditConfig,
  investment: createInvestmentEditConfig,
  other: createOtherEditConfig,
  pension: createPensionEditConfig,
  property: createPropertyEditConfig,
  subscription: createSubscriptionEditConfig,
};

export function getEditAssetConfig(assetType: AssetType): EditAssetConfig {
  return editAssetConfigFactories[assetType]();
}
