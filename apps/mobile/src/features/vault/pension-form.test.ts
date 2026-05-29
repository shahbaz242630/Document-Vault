import { describe, expect, it } from "vitest";

import { createPensionAssetPayload } from "./pension-form";

describe("createPensionAssetPayload", () => {
  it("builds a pension asset payload from valid form values", () => {
    const payload = createPensionAssetPayload({
      approximateValueRange: "200_500k",
      country: "UK",
      documentLocation: "Home safe",
      lastFourDigits: "1234",
      notes: "Company matched contributions.",
      pensionContact: "HR department",
      pensionProvider: "Example Pension",
      title: "Workplace pension",
    });

    expect(payload).toEqual({
      assetType: "pension",
      fields: {
        approximateValueRange: "200_500k",
        country: "UK",
        documentLocation: "Home safe",
        lastFourDigits: "1234",
        pensionProvider: "Example Pension",
      },
      notes: "Company matched contributions.",
      title: "Workplace pension",
    });
  });

  it("trims optional whitespace and omits blank optional values", () => {
    const payload = createPensionAssetPayload({
      approximateValueRange: "prefer_not_to_say",
      country: " UK ",
      documentLocation: " ",
      lastFourDigits: "1234",
      notes: " ",
      pensionContact: "",
      pensionProvider: " Example Pension ",
      title: " Workplace pension ",
    });

    expect(payload).toEqual({
      assetType: "pension",
      fields: {
        approximateValueRange: "prefer_not_to_say",
        country: "UK",
        lastFourDigits: "1234",
        pensionProvider: "Example Pension",
      },
      title: "Workplace pension",
    });
  });

  it("rejects full account numbers", () => {
    expect(() =>
      createPensionAssetPayload({
        approximateValueRange: "prefer_not_to_say",
        country: "UK",
        lastFourDigits: "123456789",
        pensionProvider: "Example Pension",
        title: "Workplace pension",
      }),
    ).toThrow("Enter exactly the last 4 digits.");
  });
});
