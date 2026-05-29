import { describe, expect, it } from "vitest";

import { createContactAssetPayload } from "./contact-form";

describe("createContactAssetPayload", () => {
  it("builds a contact asset payload from valid form values", () => {
    const payload = createContactAssetPayload({
      country: "UAE",
      email: "contact@example.com",
      name: "John Doe",
      notes: "Primary family lawyer.",
      phone: "+971501234567",
      relationship: "lawyer",
    });

    expect(payload).toEqual({
      assetType: "contact",
      fields: {
        country: "UAE",
        email: "contact@example.com",
        name: "John Doe",
        phone: "+971501234567",
        relationship: "lawyer",
      },
      notes: "Primary family lawyer.",
      title: "John Doe",
    });
  });

  it("trims optional whitespace and omits blank optional values", () => {
    const payload = createContactAssetPayload({
      country: " UAE ",
      email: "",
      name: " John Doe ",
      notes: " ",
      phone: "",
      relationship: "lawyer",
    });

    expect(payload).toEqual({
      assetType: "contact",
      fields: {
        country: "UAE",
        name: "John Doe",
        relationship: "lawyer",
      },
      title: "John Doe",
    });
  });

  it("rejects missing required fields", () => {
    expect(() =>
      createContactAssetPayload({
        country: "UAE",
        name: "",
        relationship: "lawyer",
      }),
    ).toThrow();
  });
});
