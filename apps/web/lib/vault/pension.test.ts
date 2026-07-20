import { describe, expect, it } from "vitest";

import { createWebPensionPayload } from "./pension";

describe("createWebPensionPayload", () => {
  it("matches the complete corrected mobile pension field contract", () => {
    expect(createWebPensionPayload({
      approximateValueRange: "200_500k",
      country: "UK",
      documentLocation: "Home safe",
      lastFourDigits: "1234",
      notes: "Company matched contributions",
      pensionContact: "HR department",
      pensionProvider: "Example Pension",
      title: "Workplace pension",
    })).toEqual({
      assetType: "pension",
      fields: {
        approximateValueRange: "200_500k",
        country: "UK",
        documentLocation: "Home safe",
        lastFourDigits: "1234",
        pensionContact: "HR department",
        pensionProvider: "Example Pension",
      },
      notes: "Company matched contributions",
      title: "Workplace pension",
    });
  });

  it("preserves future fields while allowing known optional fields to be cleared", () => {
    const payload = createWebPensionPayload({
      approximateValueRange: "prefer_not_to_say",
      country: "UK",
      documentLocation: "",
      lastFourDigits: "5678",
      notes: "",
      pensionContact: "",
      pensionProvider: "Updated Pension",
      title: "Updated pension",
    }, {
      futureMobileField: "must survive",
      pensionContact: "Old contact",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.pensionContact).toBeUndefined();
    expect(payload.fields.documentLocation).toBeUndefined();
  });

  it("rejects full pension account numbers", () => {
    expect(() => createWebPensionPayload({
      approximateValueRange: "prefer_not_to_say",
      country: "UK",
      lastFourDigits: "123456789",
      pensionProvider: "Example Pension",
      title: "Workplace pension",
    })).toThrow("Enter exactly the last 4 digits.");
  });
});
