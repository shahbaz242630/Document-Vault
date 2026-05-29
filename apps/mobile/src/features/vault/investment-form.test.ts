import { describe, expect, it } from "vitest";

import { createInvestmentAssetPayload } from "./investment-form";

describe("createInvestmentAssetPayload", () => {
  it("builds an investment asset payload from valid form values", () => {
    const payload = createInvestmentAssetPayload({
      accountType: "brokerage",
      approximateValueRange: "50_200k",
      country: "UAE",
      currency: "AED",
      documentLocation: "Home safe",
      institutionContact: "Advisor",
      institutionName: "Example Broker",
      lastFourDigits: "1234",
      notes: "Tax-advantaged account.",
      title: "Primary investment",
    });

    expect(payload).toEqual({
      assetType: "investment",
      fields: {
        accountType: "brokerage",
        approximateValueRange: "50_200k",
        country: "UAE",
        currency: "AED",
        documentLocation: "Home safe",
        institutionContact: "Advisor",
        institutionName: "Example Broker",
        lastFourDigits: "1234",
      },
      notes: "Tax-advantaged account.",
      title: "Primary investment",
    });
  });

  it("trims optional whitespace and omits blank optional values", () => {
    const payload = createInvestmentAssetPayload({
      accountType: "brokerage",
      approximateValueRange: "prefer_not_to_say",
      country: " UAE ",
      currency: " AED ",
      documentLocation: " ",
      institutionContact: "",
      institutionName: " Example Broker ",
      lastFourDigits: "1234",
      notes: " ",
      title: " Primary investment ",
    });

    expect(payload).toEqual({
      assetType: "investment",
      fields: {
        accountType: "brokerage",
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        currency: "AED",
        institutionName: "Example Broker",
        lastFourDigits: "1234",
      },
      title: "Primary investment",
    });
  });

  it("rejects full account numbers", () => {
    expect(() =>
      createInvestmentAssetPayload({
        accountType: "brokerage",
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        currency: "AED",
        institutionName: "Example Broker",
        lastFourDigits: "123456789",
        title: "Primary investment",
      }),
    ).toThrow("Enter exactly the last 4 digits.");
  });
});
