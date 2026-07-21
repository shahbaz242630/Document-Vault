import { describe, expect, it } from "vitest";

import { createWebContactPayload } from "./contact";

describe("createWebContactPayload", () => {
  it("matches the complete mobile contact field contract", () => {
    expect(createWebContactPayload({
      country: "UAE",
      email: "contact@example.com",
      name: "John Doe",
      notes: "Primary family lawyer.",
      phone: "+971501234567",
      relationship: "lawyer",
    })).toEqual({
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

  it("preserves future fields while allowing known optional fields to be cleared", () => {
    const payload = createWebContactPayload({
      country: "UAE",
      email: "",
      name: "John Doe",
      notes: "",
      phone: "",
      relationship: "accountant",
    }, {
      email: "old@example.com",
      futureMobileField: "must survive",
      phone: "+971500000000",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.email).toBeUndefined();
    expect(payload.fields.phone).toBeUndefined();
  });

  it("rejects unsupported relationships", () => {
    expect(() => createWebContactPayload({
      country: "UAE",
      name: "John Doe",
      relationship: "beneficiary",
    })).toThrow();
  });
});
