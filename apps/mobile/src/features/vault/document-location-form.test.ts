import { describe, expect, it } from "vitest";

import { createDocumentLocationAssetPayload } from "./document-location-form";

describe("createDocumentLocationAssetPayload", () => {
  it("builds a document location asset payload from valid form values", () => {
    const payload = createDocumentLocationAssetPayload({
      country: "UAE",
      custodian: "Lawyer name",
      documentType: "will",
      location: "Home safe, bedroom closet",
      notes: "Original plus two copies.",
      title: "Family will",
    });

    expect(payload).toEqual({
      assetType: "document_location",
      fields: {
        country: "UAE",
        custodian: "Lawyer name",
        documentType: "will",
        location: "Home safe, bedroom closet",
      },
      notes: "Original plus two copies.",
      title: "Family will",
    });
  });

  it("trims optional whitespace and omits blank optional values", () => {
    const payload = createDocumentLocationAssetPayload({
      country: " UAE ",
      custodian: "",
      documentType: "will",
      location: " Home safe ",
      notes: " ",
      title: " Family will ",
    });

    expect(payload).toEqual({
      assetType: "document_location",
      fields: {
        country: "UAE",
        documentType: "will",
        location: "Home safe",
      },
      title: "Family will",
    });
  });

  it("rejects missing required fields", () => {
    expect(() =>
      createDocumentLocationAssetPayload({
        country: "UAE",
        documentType: "will",
        location: "",
        title: "Family will",
      }),
    ).toThrow();
  });
});
