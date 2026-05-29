import { getRevenueCatEnv } from "@/shared/config/revenuecat-env";

type PurchasesClient = {
  configure: (config: { apiKey: string }) => void;
  getCustomerInfo: () => Promise<{
    entitlements: { active: Record<string, unknown> };
  }>;
  getOfferings: () => Promise<unknown>;
  purchasePackage: (...args: any[]) => Promise<{
    customerInfo: {
      entitlements: { active: Record<string, unknown> };
    };
  }>;
};

export type PurchaseService = {
  checkPremiumAccess(): Promise<boolean>;
  configure(): { message: string; status: "configured" | "unavailable" };
  getOfferings(): Promise<unknown | null>;
  purchasePackage(pkg: unknown): Promise<
    | { cancelled: true }
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

      // Platform selection is handled by the caller or config.
      // For now, configure with the iOS key as default.
      client.configure({ apiKey: env.iosKey });

      return {
        message: "RevenueCat is configured.",
        status: "configured",
      };
    },

    async checkPremiumAccess(): Promise<boolean> {
      if (!client) return false;

      try {
        const customerInfo = await client.getCustomerInfo();
        return customerInfo.entitlements.active["premium"] !== undefined;
      } catch {
        return false;
      }
    },

    async getOfferings(): Promise<unknown | null> {
      if (!client) return null;

      try {
        return await client.getOfferings();
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
          isPremium: customerInfo.entitlements.active["premium"] !== undefined,
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
  };
}
