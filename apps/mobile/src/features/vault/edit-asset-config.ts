import type { AssetPlaintextPayload, AssetType } from "./asset-payload";
import type { DynamicFormField } from "./components/dynamic-asset-form";
import {
  createBankAccountEditConfig,
  createContactEditConfig,
  createCryptoEditConfig,
  createDocumentLocationEditConfig,
  createExpandedAssetEditConfig,
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
  business_interest: () => createExpandedAssetEditConfig("business_interest"),
  card: () => createExpandedAssetEditConfig("card"),
  contact: createContactEditConfig,
  crypto: createCryptoEditConfig,
  dependent_pet: () => createExpandedAssetEditConfig("dependent_pet"),
  digital_account: () => createExpandedAssetEditConfig("digital_account"),
  document_location: createDocumentLocationEditConfig,
  insurance: createInsuranceEditConfig,
  investment: createInvestmentEditConfig,
  loan_debt: () => createExpandedAssetEditConfig("loan_debt"),
  medical_care: () => createExpandedAssetEditConfig("medical_care"),
  other: createOtherEditConfig,
  pension: createPensionEditConfig,
  property: createPropertyEditConfig,
  subscription: createSubscriptionEditConfig,
  vehicle: () => createExpandedAssetEditConfig("vehicle"),
};

export function getEditAssetConfig(assetType: AssetType): EditAssetConfig {
  return editAssetConfigFactories[assetType]();
}
