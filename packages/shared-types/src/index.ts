export const assetTypes = [
  "bank_account",
  "card",
  "investment",
  "property",
  "vehicle",
  "insurance",
  "crypto",
  "pension",
  "loan_debt",
  "subscription",
  "document_location",
  "contact",
  "medical_care",
  "dependent_pet",
  "business_interest",
  "digital_account",
  "other",
] as const;

export type AssetType = (typeof assetTypes)[number];
