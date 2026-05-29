import { describe, expect, it } from "vitest";

import { createInsuranceAssetPayload } from "./insurance-form";

describe("createInsuranceAssetPayload", () => {
  it("builds an insurance asset payload from valid form values", () => {
    const payload = createInsuranceAssetPayload({
      approximateValueRange: "200_500k",
      country: "UAE",
      documentLocation: "Home safe",
      insuranceContact: "Agent",
      lastFourDigits: "1234",
      notes: "Review annually.",
      policyType: "life",
      providerName: "Example Insurance",
      title: "Life policy",
    });

    expect(payload).toEqual({
      assetType: "insurance",
      fields: {
        approximateValueRange: "200_500k",
        country: "UAE",
        documentLocation: "Home safe",
        insuranceContact: "Agent",
        lastFourDigits: "1234",
        policyType: "life",
        providerName: "Example Insurance",
      },
      notes: "Review annually.",
      title: "Life policy",
    });
  });

  it("trims optional whitespace and omits blank optional values", () => {
    const payload = createInsuranceAssetPayload({
      approximateValueRange: "prefer_not_to_say",
      country: " UAE ",
      documentLocation: " ",
      insuranceContact: "",
      lastFourDigits: "1234",
      notes: " ",
      policyType: "life",
      providerName: " Example Insurance ",
      title: " Life policy ",
    });

    expect(payload).toEqual({
      assetType: "insurance",
      fields: {
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        lastFourDigits: "1234",
        policyType: "life",
        providerName: "Example Insurance",
      },
      title: "Life policy",
    });
  });

  it("rejects full policy numbers", () => {
    expect(() =>
      createInsuranceAssetPayload({
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        lastFourDigits: "123456789",
        policyType: "life",
        providerName: "Example Insurance",
        title: "Life policy",
      }),
    ).toThrow("Enter exactly the last 4 digits.");
  });
});
