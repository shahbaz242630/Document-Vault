import { describe, expect, it } from "vitest";

import { createOtherAssetPayload } from "./other-form";

describe("createOtherAssetPayload", () => {
  it("builds an other asset payload from valid form values", () => {
    const payload = createOtherAssetPayload({
      approximateValue: "10000",
      category: "Collectibles",
      country: "UAE",
      description: "Vintage watch collection",
      documentLocation: "Home safe",
      notes: "Appraised in 2024.",
      title: "Watch collection",
    });

    expect(payload).toEqual({
      assetType: "other",
      fields: {
        approximateValue: "10000",
        category: "Collectibles",
        country: "UAE",
        description: "Vintage watch collection",
        documentLocation: "Home safe",
      },
      notes: "Appraised in 2024.",
      title: "Watch collection",
    });
  });

  it("trims optional whitespace and omits blank optional values", () => {
    const payload = createOtherAssetPayload({
      approximateValue: "",
      category: "",
      country: " UAE ",
      description: " ",
      documentLocation: "",
      notes: " ",
      title: " Watch collection ",
    });

    expect(payload).toEqual({
      assetType: "other",
      fields: {
        country: "UAE",
      },
      title: "Watch collection",
    });
  });

  it("rejects missing required fields", () => {
    expect(() =>
      createOtherAssetPayload({
        country: "UAE",
        title: "",
      }),
    ).toThrow();
  });
});
