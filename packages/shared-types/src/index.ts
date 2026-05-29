export const assetTypes = [
  "bank_account",
  "investment",
  "property",
  "insurance",
  "crypto",
  "pension",
  "subscription",
  "document_location",
  "contact",
  "other",
] as const;

export type AssetType = (typeof assetTypes)[number];
