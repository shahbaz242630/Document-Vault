import { describe, expect, it } from "vitest";

import { createVaultDashboardViewModel } from "./vault-dashboard-view-model";

describe("createVaultDashboardViewModel", () => {
  it("shows an empty state when the vault has no active assets", () => {
    const viewModel = createVaultDashboardViewModel([]);

    expect(viewModel).toEqual({
      activeCount: 0,
      categories: [],
      coverageCount: 0,
      coverageGroups: [
        expect.objectContaining({ count: 0, id: "financial", isCovered: false }),
        expect.objectContaining({ count: 0, id: "property", isCovered: false }),
        expect.objectContaining({ count: 0, id: "people", isCovered: false }),
        expect.objectContaining({ count: 0, id: "digital", isCovered: false }),
      ],
      coveragePercent: 0,
      hasAssets: false,
      items: [],
      nextSuggestedGroup: expect.objectContaining({ id: "financial" }),
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
        {
          assetType: "bank_account",
          count: 2,
          label: "Bank accounts",
          routeHref: "/vault/bank-accounts",
        },
        {
          assetType: "insurance",
          count: 1,
          label: "Insurance",
          routeHref: "/vault/insurance",
        },
      ],
      coverageCount: 1,
      coverageGroups: [
        expect.objectContaining({ count: 3, id: "financial", isCovered: true }),
        expect.objectContaining({ count: 0, id: "property", isCovered: false }),
        expect.objectContaining({ count: 0, id: "people", isCovered: false }),
        expect.objectContaining({ count: 0, id: "digital", isCovered: false }),
      ],
      coveragePercent: 25,
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
      nextSuggestedGroup: expect.objectContaining({ id: "property" }),
    });
  });

  it("reports complete coverage without inventing a readiness score", () => {
    const viewModel = createVaultDashboardViewModel([
      { assetType: "bank_account", fields: {}, id: "1", title: "Bank" },
      { assetType: "property", fields: {}, id: "2", title: "Home" },
      { assetType: "contact", fields: {}, id: "3", title: "Contact" },
      { assetType: "digital_account", fields: {}, id: "4", title: "Email" },
    ]);

    expect(viewModel.coverageCount).toBe(4);
    expect(viewModel.coveragePercent).toBe(100);
    expect(viewModel.nextSuggestedGroup).toBeNull();
  });
});
