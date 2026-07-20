import { describe, expect, it } from "vitest";

import { createWebBankAccountPayload } from "./bank-account";

describe("createWebBankAccountPayload", () => {
  it("matches the full mobile bank-account field contract", () => {
    expect(createWebBankAccountPayload({
      approximateValueRange: "50_200k",
      country: "UAE",
      currency: "AED",
      documentLocation: "Home safe",
      institutionContact: "Relationship manager",
      institutionName: "Example Bank",
      lastFourDigits: "1234",
      notes: "Family instructions",
      title: "Main account",
    })).toEqual({
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
      notes: "Family instructions",
      title: "Main account",
    });
  });

  it("preserves unknown encrypted mobile fields during a web edit", () => {
    const payload = createWebBankAccountPayload({
      approximateValueRange: "prefer_not_to_say",
      country: "UAE",
      currency: "AED",
      documentLocation: "",
      institutionContact: "",
      institutionName: "Updated Bank",
      lastFourDigits: "9876",
      notes: "",
      title: "Updated account",
    }, {
      documentLocation: "Old safe",
      futureMobileField: "must survive",
      institutionName: "Old Bank",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.institutionName).toBe("Updated Bank");
    expect(payload.fields.documentLocation).toBeUndefined();
  });
});
