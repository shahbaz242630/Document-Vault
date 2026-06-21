import type { VaultDecryptedAsset } from "./vault-store";

type AssetType = VaultDecryptedAsset["assetType"];

export type VaultCategoryListItem = {
  id: string;
  summary: string;
  title: string;
  updatedAt?: string;
};

export type VaultCategoryListViewModel = {
  addHref: `/vault/add-${string}`;
  addLabel: string;
  assetType: AssetType;
  canAddMore: boolean;
  count: number;
  emptyTitle: string;
  items: VaultCategoryListItem[];
  limit: number;
  title: string;
};

type CreateVaultCategoryListViewModelInput = {
  addHref: `/vault/add-${string}`;
  addLabel: string;
  assets: VaultDecryptedAsset[];
  assetType: AssetType;
  emptyTitle: string;
  limit?: number;
  title: string;
};

export function createVaultCategoryListViewModel({
  addHref,
  addLabel,
  assets,
  assetType,
  emptyTitle,
  limit = 20,
  title,
}: CreateVaultCategoryListViewModelInput): VaultCategoryListViewModel {
  const items = assets
    .filter((asset) => asset.assetType === assetType)
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((asset) => ({
      id: asset.id,
      summary: createAssetSummary(asset),
      title: asset.title,
    }));

  return {
    addHref,
    addLabel,
    assetType,
    canAddMore: items.length < limit,
    count: items.length,
    emptyTitle,
    items,
    limit,
    title,
  };
}

function createAssetSummary(asset: VaultDecryptedAsset): string {
  if (asset.assetType === "bank_account") {
    return [
      asset.fields.currency,
      formatLastFour(asset.fields.lastFourDigits),
      formatApproximateValueRange(asset.fields.approximateValueRange),
    ]
      .filter((value): value is string => Boolean(value))
      .join(" - ");
  }

  return [
    firstPresentField(asset.fields, [
      "institutionName",
      "providerName",
      "pensionProvider",
      "serviceName",
      "address",
      "country",
      "companyName",
      "issuerName",
      "lenderName",
      "makeModel",
      "name",
      "location",
      "exchangeName",
    ]),
    formatLastFour(asset.fields.lastFourDigits),
    formatApproximateValueRange(
      asset.fields.approximateValueRange ?? asset.fields.approximateCostRange,
    ),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" - ");
}

function firstPresentField(
  fields: Record<string, string>,
  fieldNames: string[],
): string | undefined {
  return fieldNames.map((fieldName) => fields[fieldName]).find(Boolean);
}

function formatLastFour(lastFourDigits: string | undefined): string | undefined {
  return lastFourDigits ? `ending ${lastFourDigits}` : undefined;
}

function formatApproximateValueRange(value: string | undefined): string | undefined {
  const labels: Record<string, string> = {
    "50_200": "50 to 200",
    "50_200k": "50k to 200k",
    "200_500": "200 to 500",
    "200_500k": "200k to 500k",
    "500k_1m": "500k to 1m",
    over_1m: "Over 1m",
    over_500: "Over 500",
    prefer_not_to_say: "Prefer not to say",
    under_50: "Under 50",
    under_50k: "Under 50k",
  };

  return value ? labels[value] : undefined;
}
