import {
  getRevenueCatEnv,
  selectRevenueCatApiKey,
} from "@/shared/config/revenuecat-env";

import {
  REVENUECAT_ENTITLEMENT_ID,
  type RevenueCatPackageId,
} from "./revenuecat-config";

type CustomerInfoLike = {
  entitlements: { active: Record<string, unknown> };
};

type PurchasesPackageLike = {
  identifier: string;
  packageType?: string;
  product?: {
    identifier?: string;
    priceString?: string;
    title?: string;
  };
};

type PurchasesOfferingsLike = {
  all?: Record<string, { availablePackages?: PurchasesPackageLike[] }>;
  current?: { availablePackages?: PurchasesPackageLike[] } | null;
};

type PurchasesClient = {
  configure: (config: { apiKey: string }) => void;
  getCustomerInfo: () => Promise<CustomerInfoLike>;
  getOfferings: () => Promise<PurchasesOfferingsLike | null>;
  purchasePackage: (...args: any[]) => Promise<{
    customerInfo: CustomerInfoLike;
  }>;
  restorePurchases?: () => Promise<CustomerInfoLike>;
};

export type PurchaseService = {
  checkPremiumAccess(): Promise<boolean>;
  configure(): { message: string; status: "configured" | "unavailable" };
  findPackage(packageId: RevenueCatPackageId): Promise<PurchasesPackageLike | null>;
  getCustomerInfo(): Promise<CustomerInfoLike | null>;
  getOfferings(): Promise<PurchasesOfferingsLike | null>;
  purchasePackage(pkg: unknown): Promise<
    | { cancelled: true }
    | { error: true; message: string }
    | { isPremium: boolean }
  >;
  restorePurchases(): Promise<
    | { error: true; message: string }
    | { isPremium: boolean }
  >;
};

export function createPurchaseService(
  client: PurchasesClient | null,
): PurchaseService {
  return {
    configure() {
      if (!client) {
        return {
          message: "RevenueCat is not configured yet.",
          status: "unavailable",
        };
      }

      const env = getRevenueCatEnv();

      if (!env.isConfigured) {
        return {
          message: "RevenueCat API keys are missing.",
          status: "unavailable",
        };
      }

      const apiKey = selectRevenueCatApiKey(env, "ios");

      if (!apiKey) {
        return {
          message: "RevenueCat API keys are missing.",
          status: "unavailable",
        };
      }

      client.configure({ apiKey });

      return {
        message: "RevenueCat is configured.",
        status: "configured",
      };
    },

    async checkPremiumAccess(): Promise<boolean> {
      if (!client) return false;

      try {
        const customerInfo = await client.getCustomerInfo();
        return hasSanduqkinPro(customerInfo);
      } catch {
        return false;
      }
    },

    async getCustomerInfo(): Promise<CustomerInfoLike | null> {
      if (!client) return null;

      try {
        return await client.getCustomerInfo();
      } catch {
        return null;
      }
    },

    async getOfferings(): Promise<PurchasesOfferingsLike | null> {
      if (!client) return null;

      try {
        return await client.getOfferings();
      } catch {
        return null;
      }
    },

    async findPackage(packageId: RevenueCatPackageId): Promise<PurchasesPackageLike | null> {
      if (!client) return null;

      try {
        const offerings = await client.getOfferings();
        if (!offerings) return null;
        return findPackageById(offerings, packageId);
      } catch {
        return null;
      }
    },

    async purchasePackage(pkg: unknown) {
      if (!client) {
        return { error: true, message: "RevenueCat is not configured yet." };
      }

      try {
        const { customerInfo } = await client.purchasePackage(pkg);
        return {
          isPremium: hasSanduqkinPro(customerInfo),
        };
      } catch (error: unknown) {
        const err = error as { userCancelled?: boolean; message?: string };

        if (err.userCancelled) {
          return { cancelled: true };
        }

        return {
          error: true,
          message: err.message ?? "Purchase could not be completed.",
        };
      }
    },

    async restorePurchases() {
      if (!client?.restorePurchases) {
        return { error: true, message: "RevenueCat is not configured yet." };
      }

      try {
        const customerInfo = await client.restorePurchases();
        return {
          isPremium: hasSanduqkinPro(customerInfo),
        };
      } catch (error: unknown) {
        const err = error as { message?: string };

        return {
          error: true,
          message: err.message ?? "Purchases could not be restored.",
        };
      }
    },
  };
}

export function hasSanduqkinPro(customerInfo: CustomerInfoLike): boolean {
  return customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID] !== undefined;
}

export function findPackageById(
  offerings: PurchasesOfferingsLike,
  packageId: RevenueCatPackageId,
): PurchasesPackageLike | null {
  const packages = [
    ...(offerings.current?.availablePackages ?? []),
    ...Object.values(offerings.all ?? {}).flatMap(
      (offering) => offering.availablePackages ?? [],
    ),
  ];

  return (
    packages.find((pkg) => pkg.identifier === packageId) ??
    packages.find((pkg) => pkg.packageType?.toLowerCase() === packageId) ??
    packages.find((pkg) => pkg.product?.identifier === packageId) ??
    null
  );
}
