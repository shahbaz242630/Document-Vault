import { describe, expect, it } from "vitest";

import { createSubscriptionAssetPayload } from "./subscription-form";

describe("createSubscriptionAssetPayload", () => {
  it("builds a subscription asset payload from valid form values", () => {
    const payload = createSubscriptionAssetPayload({
      approximateCostRange: "50_200",
      country: "UAE",
      documentLocation: "Email inbox",
      notes: "Annual billing cycle.",
      serviceName: "Example Streaming",
      subscriptionContact: "Support",
      subscriptionType: "streaming",
      title: "Netflix family plan",
    });

    expect(payload).toEqual({
      assetType: "subscription",
      fields: {
        approximateCostRange: "50_200",
        country: "UAE",
        documentLocation: "Email inbox",
        serviceName: "Example Streaming",
        subscriptionType: "streaming",
      },
      notes: "Annual billing cycle.",
      title: "Netflix family plan",
    });
  });

  it("trims optional whitespace and omits blank optional values", () => {
    const payload = createSubscriptionAssetPayload({
      approximateCostRange: "prefer_not_to_say",
      country: " UAE ",
      documentLocation: " ",
      notes: " ",
      serviceName: " Example Streaming ",
      subscriptionContact: "",
      subscriptionType: "streaming",
      title: " Netflix family plan ",
    });

    expect(payload).toEqual({
      assetType: "subscription",
      fields: {
        approximateCostRange: "prefer_not_to_say",
        country: "UAE",
        serviceName: "Example Streaming",
        subscriptionType: "streaming",
      },
      title: "Netflix family plan",
    });
  });

  it("rejects missing required fields", () => {
    expect(() =>
      createSubscriptionAssetPayload({
        approximateCostRange: "prefer_not_to_say",
        country: "UAE",
        serviceName: "",
        subscriptionType: "streaming",
        title: "Netflix family plan",
      }),
    ).toThrow();
  });
});
