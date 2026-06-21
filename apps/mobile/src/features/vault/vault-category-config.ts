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

export const vaultCategoryConfigs = [
  {
    addHref: "/vault/add-bank-account",
    addLabel: "Add another bank account",
    assetType: "bank_account",
    emptyTitle: "No bank accounts saved yet.",
    itemLabel: "Bank account",
    routeHref: "/vault/bank-accounts",
    title: "Bank accounts",
  },
  {
    addHref: "/vault/add-card",
    addLabel: "Add another card",
    assetType: "card",
    emptyTitle: "No cards saved yet.",
    itemLabel: "Card",
    routeHref: "/vault/cards",
    title: "Cards",
  },
  {
    addHref: "/vault/add-investment",
    addLabel: "Add another investment",
    assetType: "investment",
    emptyTitle: "No investments saved yet.",
    itemLabel: "Investment",
    routeHref: "/vault/investments",
    title: "Investments",
  },
  {
    addHref: "/vault/add-property",
    addLabel: "Add another property",
    assetType: "property",
    emptyTitle: "No properties saved yet.",
    itemLabel: "Property",
    routeHref: "/vault/properties",
    title: "Properties",
  },
  {
    addHref: "/vault/add-vehicle",
    addLabel: "Add another vehicle",
    assetType: "vehicle",
    emptyTitle: "No vehicles saved yet.",
    itemLabel: "Vehicle",
    routeHref: "/vault/vehicles",
    title: "Vehicles",
  },
  {
    addHref: "/vault/add-insurance",
    addLabel: "Add another insurance record",
    assetType: "insurance",
    emptyTitle: "No insurance records saved yet.",
    itemLabel: "Insurance",
    routeHref: "/vault/insurance",
    title: "Insurance",
  },
  {
    addHref: "/vault/add-crypto",
    addLabel: "Add another crypto reference",
    assetType: "crypto",
    emptyTitle: "No crypto references saved yet.",
    itemLabel: "Crypto reference",
    routeHref: "/vault/crypto",
    title: "Crypto references",
  },
  {
    addHref: "/vault/add-pension",
    addLabel: "Add another pension",
    assetType: "pension",
    emptyTitle: "No pensions saved yet.",
    itemLabel: "Pension",
    routeHref: "/vault/pensions",
    title: "Pensions",
  },
  {
    addHref: "/vault/add-loan-debt",
    addLabel: "Add another loan or debt",
    assetType: "loan_debt",
    emptyTitle: "No loans or debts saved yet.",
    itemLabel: "Loan or debt",
    routeHref: "/vault/loans-debts",
    title: "Loans and debts",
  },
  {
    addHref: "/vault/add-subscription",
    addLabel: "Add another subscription",
    assetType: "subscription",
    emptyTitle: "No subscriptions saved yet.",
    itemLabel: "Subscription",
    routeHref: "/vault/subscriptions",
    title: "Subscriptions",
  },
  {
    addHref: "/vault/add-document-location",
    addLabel: "Add another document location",
    assetType: "document_location",
    emptyTitle: "No document locations saved yet.",
    itemLabel: "Document location",
    routeHref: "/vault/document-locations",
    title: "Document locations",
  },
  {
    addHref: "/vault/add-contact",
    addLabel: "Add another contact",
    assetType: "contact",
    emptyTitle: "No contacts saved yet.",
    itemLabel: "Contact",
    routeHref: "/vault/contacts",
    title: "Contacts",
  },
  {
    addHref: "/vault/add-medical-care",
    addLabel: "Add another medical care record",
    assetType: "medical_care",
    emptyTitle: "No medical care records saved yet.",
    itemLabel: "Medical care",
    routeHref: "/vault/medical-care",
    title: "Medical care",
  },
  {
    addHref: "/vault/add-dependent-pet",
    addLabel: "Add another dependent or pet",
    assetType: "dependent_pet",
    emptyTitle: "No dependents or pets saved yet.",
    itemLabel: "Dependent or pet",
    routeHref: "/vault/dependents-pets",
    title: "Dependents and pets",
  },
  {
    addHref: "/vault/add-business-interest",
    addLabel: "Add another business interest",
    assetType: "business_interest",
    emptyTitle: "No business interests saved yet.",
    itemLabel: "Business interest",
    routeHref: "/vault/business-interests",
    title: "Business interests",
  },
  {
    addHref: "/vault/add-digital-account",
    addLabel: "Add another digital account",
    assetType: "digital_account",
    emptyTitle: "No digital accounts saved yet.",
    itemLabel: "Digital account",
    routeHref: "/vault/digital-accounts",
    title: "Digital accounts",
  },
  {
    addHref: "/vault/add-other",
    addLabel: "Add another record",
    assetType: "other",
    emptyTitle: "No other records saved yet.",
    itemLabel: "Other",
    routeHref: "/vault/other-records",
    title: "Other",
  },
] as const satisfies readonly VaultCategoryConfig[];

export function getVaultCategoryConfig(assetType: AssetType): VaultCategoryConfig {
  const config = vaultCategoryConfigs.find((candidate) => candidate.assetType === assetType);

  if (!config) {
    throw new Error(`Unsupported vault asset type: ${assetType}`);
  }

  return config;
}
