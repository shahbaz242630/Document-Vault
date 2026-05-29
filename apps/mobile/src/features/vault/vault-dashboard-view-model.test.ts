import { describe, expect, it } from "vitest";

import { createVaultDashboardViewModel } from "./vault-dashboard-view-model";

describe("createVaultDashboardViewModel", () => {
  it("shows an empty state when the vault has no active assets", () => {
    const viewModel = createVaultDashboardViewModel([]);

    expect(viewModel).toEqual({
      activeCount: 0,
      categories: [],
      hasAssets: false,
      items: [],
    });
  });

  it("groups active assets by category with stable counts", () => {
    const viewModel = createVaultDashboardViewModel([
      {
        assetType: "bank_account",
        fields: {},
        id: "asset-1",
        title: "Primary bank reference",
      },
      {
        assetType: "bank_account",
        fields: {},
        id: "asset-2",
        title: "Savings reference",
      },
      {
        assetType: "insurance",
        fields: {},
        id: "asset-3",
        title: "Life policy reference",
      },
    ]);

    expect(viewModel).toEqual({
      activeCount: 3,
      categories: [
        { assetType: "bank_account", count: 2, label: "Bank accounts" },
        { assetType: "insurance", count: 1, label: "Insurance" },
      ],
      hasAssets: true,
      items: [
        {
          assetTypeLabel: "Insurance",
          id: "asset-3",
          title: "Life policy reference",
        },
        {
          assetTypeLabel: "Bank account",
          id: "asset-1",
          title: "Primary bank reference",
        },
        {
          assetTypeLabel: "Bank account",
          id: "asset-2",
          title: "Savings reference",
        },
      ],
    });
  });
});
