import type { VaultDecryptedAsset } from "./vault-store";

type AssetType = VaultDecryptedAsset["assetType"];

type VaultDashboardCategory = {
  assetType: AssetType;
  count: number;
  label: string;
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

const categoryLabels: Record<AssetType, string> = {
  bank_account: "Bank accounts",
  business_interest: "Business interests",
  card: "Cards",
  contact: "Contacts",
  crypto: "Crypto references",
  dependent_pet: "Dependents and pets",
  digital_account: "Digital accounts",
  document_location: "Document locations",
  insurance: "Insurance",
  investment: "Investments",
  loan_debt: "Loans and debts",
  medical_care: "Medical care",
  other: "Other",
  pension: "Pensions",
  property: "Properties",
  subscription: "Subscriptions",
  vehicle: "Vehicles",
};

const itemLabels: Record<AssetType, string> = {
  bank_account: "Bank account",
  business_interest: "Business interest",
  card: "Card",
  contact: "Contact",
  crypto: "Crypto reference",
  dependent_pet: "Dependent or pet",
  digital_account: "Digital account",
  document_location: "Document location",
  insurance: "Insurance",
  investment: "Investment",
  loan_debt: "Loan or debt",
  medical_care: "Medical care",
  other: "Other",
  pension: "Pension",
  property: "Property",
  subscription: "Subscription",
  vehicle: "Vehicle",
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

    categories.set(asset.assetType, {
      assetType: asset.assetType,
      count: 1,
      label: categoryLabels[asset.assetType],
    });
  }

  return {
    activeCount: assets.length,
    categories: Array.from(categories.values()),
    hasAssets: assets.length > 0,
    items: [...assets]
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((asset) => ({
        assetTypeLabel: itemLabels[asset.assetType],
        id: asset.id,
        title: asset.title,
      })),
  };
}
