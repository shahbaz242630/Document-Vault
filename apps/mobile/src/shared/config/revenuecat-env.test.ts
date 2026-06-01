import { describe, expect, it } from "vitest";

import { getRevenueCatEnv, selectRevenueCatApiKey } from "./revenuecat-env";

describe("getRevenueCatEnv", () => {
  it("reports RevenueCat as unconfigured when keys are missing", () => {
    const result = getRevenueCatEnv({});

    expect(result.isConfigured).toBe(false);
  });

  it("returns trimmed RevenueCat keys when configured", () => {
    const result = getRevenueCatEnv({
      EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: "  android_key_123  ",
      EXPO_PUBLIC_REVENUECAT_IOS_KEY: "  ios_key_456  ",
    });

    expect(result.isConfigured).toBe(true);
    if (result.isConfigured) {
      expect(result.iosKey).toBe("ios_key_456");
      expect(result.androidKey).toBe("android_key_123");
    }
  });

  it("supports a shared RevenueCat API key", () => {
    const result = getRevenueCatEnv({
      EXPO_PUBLIC_REVENUECAT_API_KEY: " test_shared_key ",
    });

    expect(result.isConfigured).toBe(true);
    if (result.isConfigured) {
      expect(result.sharedKey).toBe("test_shared_key");
      expect(selectRevenueCatApiKey(result, "ios")).toBe("test_shared_key");
      expect(selectRevenueCatApiKey(result, "android")).toBe("test_shared_key");
    }
  });

  it("allows a single platform key", () => {
    const result = getRevenueCatEnv({
      EXPO_PUBLIC_REVENUECAT_IOS_KEY: "ios_only",
    });

    expect(result.isConfigured).toBe(true);
    if (result.isConfigured) {
      expect(selectRevenueCatApiKey(result, "ios")).toBe("ios_only");
      expect(selectRevenueCatApiKey(result, "android")).toBeNull();
    }
  });
});
