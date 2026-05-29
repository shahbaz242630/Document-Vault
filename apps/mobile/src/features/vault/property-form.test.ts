import { describe, expect, it } from "vitest";

import { createPropertyAssetPayload } from "./property-form";

describe("createPropertyAssetPayload", () => {
  it("builds a property asset payload from valid form values", () => {
    const payload = createPropertyAssetPayload({
      address: "123 Palm Jumeirah",
      approximateValueRange: "500k_1m",
      contact: "Property manager",
      country: "UAE",
      documentLocation: "Home safe",
      mortgageProvider: "Example Mortgage",
      notes: "Joint ownership.",
      title: "Dubai apartment",
    });

    expect(payload).toEqual({
      assetType: "property",
      fields: {
        address: "123 Palm Jumeirah",
        approximateValueRange: "500k_1m",
        contact: "Property manager",
        country: "UAE",
        documentLocation: "Home safe",
        mortgageProvider: "Example Mortgage",
      },
      notes: "Joint ownership.",
      title: "Dubai apartment",
    });
  });

  it("trims optional whitespace and omits blank optional values", () => {
    const payload = createPropertyAssetPayload({
      address: " 123 Palm Jumeirah ",
      approximateValueRange: "prefer_not_to_say",
      contact: "",
      country: " UAE ",
      documentLocation: " ",
      mortgageProvider: "",
      notes: " ",
      title: " Dubai apartment ",
    });

    expect(payload).toEqual({
      assetType: "property",
      fields: {
        address: "123 Palm Jumeirah",
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
      },
      title: "Dubai apartment",
    });
  });

  it("rejects missing required fields", () => {
    expect(() =>
      createPropertyAssetPayload({
        address: "",
        approximateValueRange: "prefer_not_to_say",
        country: "UAE",
        title: "Dubai apartment",
      }),
    ).toThrow();
  });
});
