import { describe, expect, it } from "vitest";

import { createWebPropertyPayload } from "./property";

describe("createWebPropertyPayload", () => {
  it("matches the complete mobile property field contract", () => {
    expect(createWebPropertyPayload({
      address: "123 Palm Jumeirah",
      approximateValueRange: "500k_1m",
      contact: "Property manager",
      country: "UAE",
      documentLocation: "Home safe",
      mortgageProvider: "Example Mortgage",
      notes: "Joint ownership",
      title: "Dubai apartment",
    })).toEqual({
      assetType: "property",
      fields: {
        address: "123 Palm Jumeirah",
        approximateValueRange: "500k_1m",
        contact: "Property manager",
        country: "UAE",
        documentLocation: "Home safe",
        mortgageProvider: "Example Mortgage",
      },
      notes: "Joint ownership",
      title: "Dubai apartment",
    });
  });

  it("preserves future fields while allowing known optional fields to be cleared", () => {
    const payload = createWebPropertyPayload({
      address: "Updated address",
      approximateValueRange: "prefer_not_to_say",
      contact: "",
      country: "UAE",
      documentLocation: "",
      mortgageProvider: "",
      notes: "",
      title: "Updated property",
    }, {
      contact: "Old manager",
      futureMobileField: "must survive",
      mortgageProvider: "Old lender",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.contact).toBeUndefined();
    expect(payload.fields.mortgageProvider).toBeUndefined();
  });

  it("rejects a missing address", () => {
    expect(() => createWebPropertyPayload({
      address: "",
      approximateValueRange: "prefer_not_to_say",
      country: "UAE",
      title: "Dubai apartment",
    })).toThrow();
  });
});
