import { describe, expect, it } from "vitest";

import { createVaultExportModel } from "./vault-export-model";
import type { VaultDecryptedAsset } from "./vault-store";

const assets: VaultDecryptedAsset[] = [
  {
    assetType: "card",
    fields: {
      "Card type": "Credit",
      "Issuer / bank": "Example Bank",
      "Last 4 digits": "1234",
    },
    id: "asset-card",
    notes: "Keep this for family records.",
    title: "Travel card",
  },
  {
    assetType: "bank_account",
    fields: {
      "Account type": "Current",
      "Bank name": "GCC Bank",
    },
    id: "asset-bank",
    title: "Primary account",
  },
];

describe("createVaultExportModel", () => {
  it("groups decrypted vault assets by readable category labels", () => {
    const model = createVaultExportModel({
      assets,
      exportedAt: new Date("2026-06-03T10:00:00.000Z"),
    });

    expect(model.generatedAtLabel).toBe("03 Jun 2026, 10:00 UTC");
    expect(model.sections).toEqual([
      {
        assetType: "bank_account",
        label: "Bank accounts",
        items: [
          {
            fields: [
              { label: "Account type", value: "Current" },
              { label: "Bank name", value: "GCC Bank" },
            ],
            id: "asset-bank",
            notes: null,
            title: "Primary account",
          },
        ],
      },
      {
        assetType: "card",
        label: "Cards",
        items: [
          {
            fields: [
              { label: "Card type", value: "Credit" },
              { label: "Issuer / bank", value: "Example Bank" },
              { label: "Last 4 digits", value: "1234" },
            ],
            id: "asset-card",
            notes: "Keep this for family records.",
            title: "Travel card",
          },
        ],
      },
    ]);
  });

  it("omits empty field values and trims notes", () => {
    const model = createVaultExportModel({
      assets: [
        {
          assetType: "other",
          fields: { Empty: "   ", Kept: " Value " },
          id: "asset-other",
          notes: "  Useful note  ",
          title: " Other item ",
        },
      ],
      exportedAt: new Date("2026-06-03T10:00:00.000Z"),
    });

    expect(model.sections[0]?.items[0]).toMatchObject({
      fields: [{ label: "Kept", value: "Value" }],
      notes: "Useful note",
      title: "Other item",
    });
  });
});
