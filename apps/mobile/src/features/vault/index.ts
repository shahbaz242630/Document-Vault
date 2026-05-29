/**
 * Vault owns encrypted asset CRUD and client-side decrypt/render behavior.
 * Phase 1 must keep all vault content encrypted before any network call.
 */

// Components
export { AssetDetailView } from "./components/asset-detail-view";
export { DynamicAssetForm } from "./components/dynamic-asset-form";
export { RecentlyDeletedList } from "./components/recently-deleted-list";
export { VaultDashboard } from "./components/vault-dashboard";
export {
  decryptAssetPayload,
  encryptAssetPayload,
  type AssetPlaintextPayload,
  type EncryptedAssetPayload,
} from "./asset-payload";
export {
  createBankAccountAssetPayload,
  type BankAccountFormValues,
} from "./bank-account-form";
export {
  createBankAccountFormViewModel,
  type BankAccountFormViewModel,
} from "./bank-account-form-view-model";
export {
  createContactAssetPayload,
  type ContactFormValues,
} from "./contact-form";
export {
  createContactFormViewModel,
  type ContactFormViewModel,
} from "./contact-form-view-model";
export {
  createCryptoAssetPayload,
  type CryptoFormValues,
} from "./crypto-form";
export {
  createCryptoFormViewModel,
  type CryptoFormViewModel,
} from "./crypto-form-view-model";
export {
  createDocumentLocationAssetPayload,
  type DocumentLocationFormValues,
} from "./document-location-form";
export {
  createDocumentLocationFormViewModel,
  type DocumentLocationFormViewModel,
} from "./document-location-form-view-model";
export {
  getEditAssetConfig,
  type EditAssetConfig,
} from "./edit-asset-config";
export {
  createInsuranceAssetPayload,
  type InsuranceFormValues,
} from "./insurance-form";
export {
  createInsuranceFormViewModel,
  type InsuranceFormViewModel,
} from "./insurance-form-view-model";
export {
  createInvestmentAssetPayload,
  type InvestmentFormValues,
} from "./investment-form";
export {
  createInvestmentFormViewModel,
  type InvestmentFormViewModel,
} from "./investment-form-view-model";
export {
  createOtherAssetPayload,
  type OtherFormValues,
} from "./other-form";
export {
  createOtherFormViewModel,
  type OtherFormViewModel,
} from "./other-form-view-model";
export {
  createPensionAssetPayload,
  type PensionFormValues,
} from "./pension-form";
export {
  createPensionFormViewModel,
  type PensionFormViewModel,
} from "./pension-form-view-model";
export {
  createPropertyAssetPayload,
  type PropertyFormValues,
} from "./property-form";
export {
  createPropertyFormViewModel,
  type PropertyFormViewModel,
} from "./property-form-view-model";
export {
  createSubscriptionAssetPayload,
  type SubscriptionFormValues,
} from "./subscription-form";
export {
  createSubscriptionFormViewModel,
  type SubscriptionFormViewModel,
} from "./subscription-form-view-model";
export {
  deserializeVaultAssetRow,
  deserializeVaultKeyMaterial,
  serializeVaultAssetRecord,
  serializeVaultKeyMaterial,
  type SupabaseVaultAssetInsert,
  type SupabaseVaultAssetRow,
  type SupabaseVaultKeyMaterialRow,
  type VaultKeyMaterial,
} from "./supabase-vault-codec";
export {
  createVaultStore,
  type VaultDeletedAsset,
  type VaultDecryptedAsset,
  type VaultEncryptedAssetRecord,
} from "./vault-store";
export {
  createVaultDashboardViewModel,
  type VaultDashboardViewModel,
} from "./vault-dashboard-view-model";
export {
  createRecentlyDeletedViewModel,
  type RecentlyDeletedViewModel,
} from "./recently-deleted-view-model";
export {
  createVaultSession,
  type VaultSession,
} from "./vault-session";
export {
  useVaultSession,
  VaultSessionProvider,
} from "./vault-session-context";
