import { describe, expect, it } from "vitest";

import { createWebInsurancePayload } from "./insurance";

describe("createWebInsurancePayload", () => {
  it("matches the complete mobile insurance field contract", () => {
    expect(createWebInsurancePayload({
      approximateValueRange: "200_500k",
      country: "UAE",
      documentLocation: "Home safe",
      insuranceContact: "Agent",
      lastFourDigits: "1234",
      notes: "Review annually",
      policyType: "life",
      providerName: "Example Insurance",
      title: "Life policy",
    })).toEqual({
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
      notes: "Review annually",
      title: "Life policy",
    });
  });

  it("preserves future fields while allowing known optional fields to be cleared", () => {
    const payload = createWebInsurancePayload({
      approximateValueRange: "prefer_not_to_say",
      country: "UAE",
      documentLocation: "",
      insuranceContact: "",
      lastFourDigits: "5678",
      notes: "",
      policyType: "health",
      providerName: "Updated Insurance",
      title: "Updated policy",
    }, {
      futureMobileField: "must survive",
      insuranceContact: "Old agent",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.insuranceContact).toBeUndefined();
    expect(payload.fields.documentLocation).toBeUndefined();
  });

  it("rejects full policy numbers", () => {
    expect(() => createWebInsurancePayload({
      approximateValueRange: "prefer_not_to_say",
      country: "UAE",
      lastFourDigits: "123456789",
      policyType: "life",
      providerName: "Example Insurance",
      title: "Life policy",
    })).toThrow("Enter exactly the last 4 digits.");
  });
});
