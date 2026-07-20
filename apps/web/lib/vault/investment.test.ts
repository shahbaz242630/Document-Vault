import { describe, expect, it } from "vitest";

import { createWebInvestmentPayload } from "./investment";

describe("createWebInvestmentPayload", () => {
  it("matches the complete mobile investment field contract", () => {
    expect(createWebInvestmentPayload({
      accountType: "brokerage",
      approximateValueRange: "50_200k",
      country: "UAE",
      currency: "AED",
      documentLocation: "Home safe",
      institutionContact: "Advisor",
      institutionName: "Example Broker",
      lastFourDigits: "1234",
      notes: "Family instructions",
      title: "Primary investment",
    })).toEqual({
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
      notes: "Family instructions",
      title: "Primary investment",
    });
  });

  it("preserves future fields while allowing known optional fields to be cleared", () => {
    const payload = createWebInvestmentPayload({
      accountType: "retirement",
      approximateValueRange: "prefer_not_to_say",
      country: "UAE",
      currency: "AED",
      documentLocation: "",
      institutionContact: "",
      institutionName: "Updated Broker",
      lastFourDigits: "5678",
      notes: "",
      title: "Updated investment",
    }, {
      documentLocation: "Old location",
      futureMobileField: "must survive",
      institutionContact: "Old advisor",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.documentLocation).toBeUndefined();
    expect(payload.fields.institutionContact).toBeUndefined();
  });

  it("rejects full account numbers", () => {
    expect(() => createWebInvestmentPayload({
      accountType: "brokerage",
      approximateValueRange: "prefer_not_to_say",
      country: "UAE",
      currency: "AED",
      institutionName: "Example Broker",
      lastFourDigits: "123456789",
      title: "Primary investment",
    })).toThrow("Enter exactly the last 4 digits.");
  });
});
