import type { VaultDeletedAsset } from "./vault-store";

type RecentlyDeletedItem = {
  assetTypeLabel: string;
  deletedAtLabel: string;
  id: string;
  title: string;
};

export type RecentlyDeletedViewModel = {
  hasDeletedAssets: boolean;
  items: RecentlyDeletedItem[];
  totalCount: number;
};

const assetTypeLabels: Record<VaultDeletedAsset["assetType"], string> = {
  bank_account: "Bank account",
  contact: "Contact",
  crypto: "Crypto reference",
  document_location: "Document location",
  insurance: "Insurance",
  investment: "Investment",
  other: "Other",
  pension: "Pension",
  property: "Property",
  subscription: "Subscription",
};

const deletedDateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function createRecentlyDeletedViewModel(
  assets: VaultDeletedAsset[],
): RecentlyDeletedViewModel {
  const items = [...assets]
    .sort((left, right) => right.deletedAt.localeCompare(left.deletedAt))
    .map((asset) => ({
      assetTypeLabel: assetTypeLabels[asset.assetType],
      deletedAtLabel: `Deleted ${deletedDateFormatter.format(new Date(asset.deletedAt))}`,
      id: asset.id,
      title: asset.title,
    }));

  return {
    hasDeletedAssets: items.length > 0,
    items,
    totalCount: items.length,
  };
}
