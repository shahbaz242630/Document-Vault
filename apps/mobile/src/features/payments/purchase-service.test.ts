import { describe, expect, it } from "vitest";

import { createPurchaseService } from "./purchase-service";

const activeProEntitlement = { "Sanduqkin Pro": { expiresDate: null } };

describe("createPurchaseService", () => {
  describe("configure", () => {
    it("returns unavailable when the Purchases client is null", () => {
      const service = createPurchaseService(null);
      const result = service.configure();

      expect(result.status).toBe("unavailable");
    });

    it("returns unavailable when RevenueCat env keys are missing", () => {
      const service = createPurchaseService({
        configure: () => {},
        async getCustomerInfo() {
          return { entitlements: { active: {} } };
        },
        async getOfferings() {
          return null;
        },
        async purchasePackage() {
          return { customerInfo: { entitlements: { active: {} } } };
        },
      });

      const result = service.configure();

      expect(result.status).toBe("unavailable");
    });

    it("returns configured when client and env keys exist", () => {
      const configureCalls: unknown[] = [];
      const service = createPurchaseService({
        configure(config) {
          configureCalls.push(config);
        },
        async getCustomerInfo() {
          return { entitlements: { active: {} } };
        },
        async getOfferings() {
          return null;
        },
        async purchasePackage() {
          return { customerInfo: { entitlements: { active: {} } } };
        },
      });

      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: "android_test_key",
        EXPO_PUBLIC_REVENUECAT_IOS_KEY: "ios_test_key",
      };

      try {
        const result = service.configure();

        expect(result.status).toBe("configured");
        expect(configureCalls).toHaveLength(1);
        expect((configureCalls[0] as { apiKey: string }).apiKey).toBe(
          "ios_test_key",
        );
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe("checkPremiumAccess", () => {
    it("returns false when the client is null", async () => {
      const service = createPurchaseService(null);
      const result = await service.checkPremiumAccess();

      expect(result).toBe(false);
    });

    it("returns true when the Sanduqkin Pro entitlement is active", async () => {
      const service = createPurchaseService({
        configure: () => {},
        async getCustomerInfo() {
          return {
            entitlements: {
              active: activeProEntitlement,
            },
          };
        },
        async getOfferings() {
          return null;
        },
        async purchasePackage() {
          return { customerInfo: { entitlements: { active: {} } } };
        },
      });

      const result = await service.checkPremiumAccess();

      expect(result).toBe(true);
    });

    it("returns false when the Sanduqkin Pro entitlement is missing", async () => {
      const service = createPurchaseService({
        configure: () => {},
        async getCustomerInfo() {
          return { entitlements: { active: {} } };
        },
        async getOfferings() {
          return null;
        },
        async purchasePackage() {
          return { customerInfo: { entitlements: { active: {} } } };
        },
      });

      const result = await service.checkPremiumAccess();

      expect(result).toBe(false);
    });

    it("returns false when getCustomerInfo throws", async () => {
      const service = createPurchaseService({
        configure: () => {},
        async getCustomerInfo() {
          throw new Error("Network error");
        },
        async getOfferings() {
          return null;
        },
        async purchasePackage() {
          return { customerInfo: { entitlements: { active: {} } } };
        },
      });

      const result = await service.checkPremiumAccess();

      expect(result).toBe(false);
    });
  });

  describe("findPackage", () => {
    it("finds monthly and yearly packages from the current offering", async () => {
      const service = createPurchaseService({
        configure: () => {},
        async getCustomerInfo() {
          return { entitlements: { active: {} } };
        },
        async getOfferings() {
          return {
            current: {
              availablePackages: [
                { identifier: "monthly", product: { identifier: "monthly" } },
                { identifier: "yearly", product: { identifier: "yearly" } },
              ],
            },
          };
        },
        async purchasePackage() {
          return { customerInfo: { entitlements: { active: {} } } };
        },
      });

      await expect(service.findPackage("monthly")).resolves.toMatchObject({
        identifier: "monthly",
      });
      await expect(service.findPackage("yearly")).resolves.toMatchObject({
        identifier: "yearly",
      });
    });
  });

  describe("getOfferings", () => {
    it("returns null when the client is null", async () => {
      const service = createPurchaseService(null);
      const result = await service.getOfferings();

      expect(result).toBeNull();
    });

    it("returns offerings from the client", async () => {
      const mockOfferings = { current: null };
      const service = createPurchaseService({
        configure: () => {},
        async getCustomerInfo() {
          return { entitlements: { active: {} } };
        },
        async getOfferings() {
          return mockOfferings;
        },
        async purchasePackage() {
          return { customerInfo: { entitlements: { active: {} } } };
        },
      });

      const result = await service.getOfferings();

      expect(result).toBe(mockOfferings);
    });
  });

  describe("purchasePackage", () => {
    it("returns error when the client is null", async () => {
      const service = createPurchaseService(null);
      const result = await service.purchasePackage({ id: "test" });

      expect(result).toEqual({
        error: true,
        message: "RevenueCat is not configured yet.",
      });
    });

    it("returns isPremium true after a successful purchase", async () => {
      const service = createPurchaseService({
        configure: () => {},
        async getCustomerInfo() {
          return { entitlements: { active: {} } };
        },
        async getOfferings() {
          return null;
        },
        async purchasePackage() {
          return {
            customerInfo: {
              entitlements: { active: activeProEntitlement },
            },
          };
        },
      });

      const result = await service.purchasePackage({ id: "monthly" });

      expect(result).toEqual({ isPremium: true });
    });

    it("returns cancelled when the user cancels", async () => {
      const service = createPurchaseService({
        configure: () => {},
        async getCustomerInfo() {
          return { entitlements: { active: {} } };
        },
        async getOfferings() {
          return null;
        },
        async purchasePackage() {
          const err = new Error("User cancelled") as Error & {
            userCancelled: boolean;
          };
          err.userCancelled = true;
          throw err;
        },
      });

      const result = await service.purchasePackage({ id: "monthly" });

      expect(result).toEqual({ cancelled: true });
    });
  });

  describe("restorePurchases", () => {
    it("returns isPremium true when restore returns the Sanduqkin Pro entitlement", async () => {
      const service = createPurchaseService({
        configure: () => {},
        async getCustomerInfo() {
          return { entitlements: { active: {} } };
        },
        async getOfferings() {
          return null;
        },
        async purchasePackage() {
          return { customerInfo: { entitlements: { active: {} } } };
        },
        async restorePurchases() {
          return { entitlements: { active: activeProEntitlement } };
        },
      });

      await expect(service.restorePurchases()).resolves.toEqual({
        isPremium: true,
      });
    });
  });
});
