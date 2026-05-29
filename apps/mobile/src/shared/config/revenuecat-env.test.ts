import { describe, expect, it } from "vitest";

import { getRevenueCatEnv } from "./revenuecat-env";

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

  it("reports unconfigured when only one key is present", () => {
    const result = getRevenueCatEnv({
      EXPO_PUBLIC_REVENUECAT_IOS_KEY: "ios_only",
    });

    expect(result.isConfigured).toBe(false);
  });
});
