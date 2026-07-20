import { describe, expect, it } from "vitest";

import { createWebCardPayload } from "./card";

describe("createWebCardPayload", () => {
  it("matches the complete mobile card field contract", () => {
    expect(createWebCardPayload({
      cardType: "Credit",
      country: "UAE",
      issuerName: "Example Bank",
      lastFourDigits: "1234",
      notes: "Family instructions",
      supportContact: "Support desk",
      title: "Main card",
    })).toEqual({
      assetType: "card",
      fields: {
        cardType: "Credit",
        country: "UAE",
        issuerName: "Example Bank",
        lastFourDigits: "1234",
        supportContact: "Support desk",
      },
      notes: "Family instructions",
      title: "Main card",
    });
  });

  it("preserves future fields while allowing known optional fields to be cleared", () => {
    const payload = createWebCardPayload({
      cardType: "",
      country: "UAE",
      issuerName: "Updated Bank",
      lastFourDigits: "",
      notes: "",
      supportContact: "",
      title: "Updated card",
    }, {
      cardType: "Old type",
      futureMobileField: "must survive",
      lastFourDigits: "1234",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.cardType).toBeUndefined();
    expect(payload.fields.lastFourDigits).toBeUndefined();
  });
});
