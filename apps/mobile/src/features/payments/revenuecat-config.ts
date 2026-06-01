export const REVENUECAT_ENTITLEMENT_ID = "Sanduqkin Pro";

export const REVENUECAT_PACKAGE_IDS = {
  monthly: "monthly",
  yearly: "yearly",
} as const;

export type RevenueCatPackageId =
  (typeof REVENUECAT_PACKAGE_IDS)[keyof typeof REVENUECAT_PACKAGE_IDS];
