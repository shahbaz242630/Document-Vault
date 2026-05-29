import { describe, expect, it } from "vitest";

import { createBankAccountAssetPayload } from "./bank-account-form";

describe("createBankAccountAssetPayload", () => {
  it("builds a bank account asset payload from valid form values", () => {
    const payload = createBankAccountAssetPayload({
      approximateValueRange: "50_200k",
      country: "UAE",
      currency: "AED",
      documentLocation: "Home safe",
      institutionContact: "Relationship manager",
      institutionName: "Example Bank",
      lastFourDigits: "1234",
      notes: "Start with this account.",
      title: "Primary bank reference",
    });

    expect(payload).toEqual({
      assetType: "bank_account",
      fields: {
        approximateValueRange: "50_200k",
        country: "UAE",
        currency: "AED",
        documentLocation: "Home safe",
        institutionContact: "Relationship manager",
        institutionName: "Example Bank",
        lastFourDigits: "1234",
      },
      notes: "Start with this account.",
      title: "Primary bank reference",
    });
  });

  it("trims optional whitespace and omits blank optional values", () => {
    const payload = createBankAccountAssetPayload({
      approximateValueRange: "prefer_not_to_say",
      country: " UAE ",
      currency: " AED ",
      documentLocation: " ",
      institutionContact: "",
      institutionName: " Example Bank ",
      lastFourDigits: "1234",
      notes: " ",
      title: " Primary bank reference ",
    });

    expect(payload).toEqual({
      assetType: "bank_account",
      fields: {
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        currency: "AED",
        institutionName: "Example Bank",
        lastFourDigits: "1234",
      },
      title: "Primary bank reference",
    });
  });

  it("rejects full account numbers", () => {
    expect(() =>
      createBankAccountAssetPayload({
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        currency: "AED",
        institutionName: "Example Bank",
        lastFourDigits: "123456789",
        title: "Primary bank reference",
      }),
    ).toThrow("Enter exactly the last 4 digits.");
  });
});
