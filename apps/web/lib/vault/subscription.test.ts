import { describe, expect, it } from "vitest";

import { createWebSubscriptionPayload } from "./subscription";

describe("createWebSubscriptionPayload", () => {
  it("matches the complete corrected mobile subscription field contract", () => {
    expect(createWebSubscriptionPayload({
      approximateCostRange: "50_200",
      country: "UAE",
      documentLocation: "Email inbox",
      notes: "Annual billing cycle",
      serviceName: "Example Streaming",
      subscriptionContact: "Support",
      subscriptionType: "streaming",
      title: "Family plan",
    })).toEqual({
      assetType: "subscription",
      fields: {
        approximateCostRange: "50_200",
        country: "UAE",
        documentLocation: "Email inbox",
        serviceName: "Example Streaming",
        subscriptionContact: "Support",
        subscriptionType: "streaming",
      },
      notes: "Annual billing cycle",
      title: "Family plan",
    });
  });

  it("preserves future fields while allowing known optional fields to be cleared", () => {
    const payload = createWebSubscriptionPayload({
      approximateCostRange: "prefer_not_to_say",
      country: "UAE",
      documentLocation: "",
      notes: "",
      serviceName: "Updated Service",
      subscriptionContact: "",
      subscriptionType: "software",
      title: "Updated subscription",
    }, {
      futureMobileField: "must survive",
      subscriptionContact: "Old support",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.subscriptionContact).toBeUndefined();
    expect(payload.fields.documentLocation).toBeUndefined();
  });

  it("rejects unsupported subscription types", () => {
    expect(() => createWebSubscriptionPayload({
      approximateCostRange: "prefer_not_to_say",
      country: "UAE",
      serviceName: "Example Service",
      subscriptionType: "membership",
      title: "Membership",
    })).toThrow();
  });
});
