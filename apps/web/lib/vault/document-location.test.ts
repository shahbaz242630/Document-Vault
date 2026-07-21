import { describe, expect, it } from "vitest";

import { createWebDocumentLocationPayload } from "./document-location";

describe("createWebDocumentLocationPayload", () => {
  it("matches the complete mobile document-location field contract", () => {
    expect(createWebDocumentLocationPayload({
      country: "UAE",
      custodian: "Lawyer name",
      documentType: "will",
      location: "Home safe, bedroom closet",
      notes: "Original plus two copies",
      title: "Family will",
    })).toEqual({
      assetType: "document_location",
      fields: {
        country: "UAE",
        custodian: "Lawyer name",
        documentType: "will",
        location: "Home safe, bedroom closet",
      },
      notes: "Original plus two copies",
      title: "Family will",
    });
  });

  it("preserves future fields while allowing the known optional custodian to be cleared", () => {
    const payload = createWebDocumentLocationPayload({
      country: "UAE",
      custodian: "",
      documentType: "deed",
      location: "Updated safe",
      notes: "",
      title: "Property deed",
    }, {
      custodian: "Old custodian",
      futureMobileField: "must survive",
    });

    expect(payload.fields.futureMobileField).toBe("must survive");
    expect(payload.fields.custodian).toBeUndefined();
  });

  it("rejects unsupported document types", () => {
    expect(() => createWebDocumentLocationPayload({
      country: "UAE",
      documentType: "birth_certificate",
      location: "Home safe",
      title: "Certificate",
    })).toThrow();
  });
});
