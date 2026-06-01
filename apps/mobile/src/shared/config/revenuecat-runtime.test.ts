import { describe, expect, it } from "vitest";

import { shouldUseRevenueCatNativeBridge } from "./revenuecat-runtime";

describe("shouldUseRevenueCatNativeBridge", () => {
  it("does not use the native bridge in Expo Go", () => {
    expect(
      shouldUseRevenueCatNativeBridge({
        appOwnership: "expo",
        platform: "android",
      }),
    ).toBe(false);
  });

  it("does not use the native bridge on web", () => {
    expect(
      shouldUseRevenueCatNativeBridge({
        appOwnership: null,
        platform: "web",
      }),
    ).toBe(false);
  });

  it("uses the native bridge in standalone native builds", () => {
    expect(
      shouldUseRevenueCatNativeBridge({
        appOwnership: "standalone",
        platform: "android",
      }),
    ).toBe(true);
  });
});
