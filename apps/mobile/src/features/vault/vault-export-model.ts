import type { AssetType } from "./asset-payload";
import type { VaultDecryptedAsset } from "./vault-store";

export type VaultExportField = {
  label: string;
  value: string;
};

export type VaultExportItem = {
  fields: VaultExportField[];
  id: string;
  notes: string | null;
  title: string;
};

export type VaultExportSection = {
  assetType: AssetType;
  items: VaultExportItem[];
  label: string;
};

export type VaultExportModel = {
  generatedAtLabel: string;
  sections: VaultExportSection[];
};

const categoryLabels: Record<AssetType, string> = {
  bank_account: "Bank accounts",
  business_interest: "Business interests",
  card: "Cards",
  contact: "Contacts",
  crypto: "Crypto",
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

const categoryOrder = Object.keys(categoryLabels) as AssetType[];

export function createVaultExportModel({
  assets,
  exportedAt,
}: {
  assets: VaultDecryptedAsset[];
  exportedAt: Date;
}): VaultExportModel {
  return {
    generatedAtLabel: formatExportDate(exportedAt),
    sections: categoryOrder
      .map((assetType) => createSection(assetType, assets))
      .filter((section): section is VaultExportSection => section.items.length > 0),
  };
}

function createSection(
  assetType: AssetType,
  assets: VaultDecryptedAsset[],
): VaultExportSection {
  return {
    assetType,
    items: assets
      .filter((asset) => asset.assetType === assetType)
      .map(createExportItem)
      .sort((left, right) => left.title.localeCompare(right.title)),
    label: categoryLabels[assetType],
  };
}

function createExportItem(asset: VaultDecryptedAsset): VaultExportItem {
  return {
    fields: Object.entries(asset.fields)
      .map(([label, value]) => ({
        label: label.trim(),
        value: value.trim(),
      }))
      .filter((field) => field.label.length > 0 && field.value.length > 0),
    id: asset.id,
    notes: normalizeOptionalText(asset.notes),
    title: asset.title.trim(),
  };
}

function normalizeOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function formatExportDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric",
  }).format(date);
}
