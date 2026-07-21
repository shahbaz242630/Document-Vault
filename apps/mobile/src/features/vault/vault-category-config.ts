import { schemaDrivenVaultCategories } from "@vault/shared-validation";

import type { AssetType } from "./asset-payload";

export type VaultCategoryConfig = {
  addHref: `/vault/add-${string}`;
  addLabel: string;
  assetType: AssetType;
  emptyTitle: string;
  itemLabel: string;
  routeHref: `/vault/${string}`;
  title: string;
};

const categoryRoutes: Record<AssetType, {
  addHref: `/vault/add-${string}`;
  routeHref: `/vault/${string}`;
}> = {
  bank_account: { addHref: "/vault/add-bank-account", routeHref: "/vault/bank-accounts" },
  business_interest: { addHref: "/vault/add-business-interest", routeHref: "/vault/business-interests" },
  card: { addHref: "/vault/add-card", routeHref: "/vault/cards" },
  contact: { addHref: "/vault/add-contact", routeHref: "/vault/contacts" },
  crypto: { addHref: "/vault/add-crypto", routeHref: "/vault/crypto" },
  dependent_pet: { addHref: "/vault/add-dependent-pet", routeHref: "/vault/dependents-pets" },
  digital_account: { addHref: "/vault/add-digital-account", routeHref: "/vault/digital-accounts" },
  document_location: { addHref: "/vault/add-document-location", routeHref: "/vault/document-locations" },
  insurance: { addHref: "/vault/add-insurance", routeHref: "/vault/insurance" },
  investment: { addHref: "/vault/add-investment", routeHref: "/vault/investments" },
  loan_debt: { addHref: "/vault/add-loan-debt", routeHref: "/vault/loans-debts" },
  medical_care: { addHref: "/vault/add-medical-care", routeHref: "/vault/medical-care" },
  other: { addHref: "/vault/add-other", routeHref: "/vault/other-records" },
  pension: { addHref: "/vault/add-pension", routeHref: "/vault/pensions" },
  property: { addHref: "/vault/add-property", routeHref: "/vault/properties" },
  subscription: { addHref: "/vault/add-subscription", routeHref: "/vault/subscriptions" },
  vehicle: { addHref: "/vault/add-vehicle", routeHref: "/vault/vehicles" },
};

export const vaultCategoryConfigs: readonly VaultCategoryConfig[] = schemaDrivenVaultCategories.map((definition) => ({
  ...categoryRoutes[definition.assetType],
  addLabel: `Add another ${definition.categoryLabel.toLowerCase()}`,
  assetType: definition.assetType,
  emptyTitle: `No ${definition.pluralLabel.toLowerCase()} saved yet.`,
  itemLabel: definition.categoryLabel,
  title: definition.pluralLabel,
}));

export function getVaultCategoryConfig(assetType: AssetType): VaultCategoryConfig {
  const config = vaultCategoryConfigs.find((candidate) => candidate.assetType === assetType);
  if (!config) throw new Error(`Unsupported vault asset type: ${assetType}`);
  return config;
}
