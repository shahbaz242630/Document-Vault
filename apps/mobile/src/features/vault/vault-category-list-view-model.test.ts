import { describe, expect, it } from "vitest";

import { createVaultCategoryListViewModel } from "./vault-category-list-view-model";

describe("createVaultCategoryListViewModel", () => {
  it("filters and summarizes bank account records", () => {
    const viewModel = createVaultCategoryListViewModel({
      addHref: "/vault/add-bank-account",
      addLabel: "Add another bank account",
      assetType: "bank_account",
      assets: [
        {
          assetType: "insurance",
          fields: { provider: "Covered" },
          id: "insurance-1",
          title: "Life policy",
        },
        {
          assetType: "bank_account",
          fields: {
            approximateValueRange: "prefer_not_to_say",
            currency: "AED",
            institutionName: "Zayed Bank",
            lastFourDigits: "4242",
          },
          id: "bank-2",
          title: "Zayed savings",
        },
        {
          assetType: "bank_account",
          fields: {
            approximateValueRange: "under_50k",
            currency: "USD",
            institutionName: "Apostrophe Bank",
            lastFourDigits: "8181",
          },
          id: "bank-1",
          title: "O'Connor operating account",
        },
      ],
      emptyTitle: "No bank accounts yet",
      title: "Bank accounts",
    });

    expect(viewModel).toEqual({
      addHref: "/vault/add-bank-account",
      addLabel: "Add another bank account",
      assetType: "bank_account",
      canAddMore: true,
      count: 2,
      emptyTitle: "No bank accounts yet",
      items: [
        {
          id: "bank-1",
          summary: "USD - ending 8181 - Under 50k",
          title: "O'Connor operating account",
        },
        {
          id: "bank-2",
          summary: "AED - ending 4242 - Prefer not to say",
          title: "Zayed savings",
        },
      ],
      limit: 20,
      title: "Bank accounts",
    });
  });

  it("creates useful summaries for non-bank categories", () => {
    const viewModel = createVaultCategoryListViewModel({
      addHref: "/vault/add-investment",
      addLabel: "Add another investment",
      assetType: "investment",
      assets: [
        {
          assetType: "investment",
          fields: {
            approximateValueRange: "50_200k",
            currency: "AED",
            institutionName: "O'Connor Brokerage",
            lastFourDigits: "2222",
          },
          id: "investment-1",
          title: "Brokerage account",
        },
      ],
      emptyTitle: "No investments yet",
      title: "Investments",
    });

    expect(viewModel.items).toEqual([
      {
        id: "investment-1",
        summary: "O'Connor Brokerage - ending 2222 - 50k to 200k",
        title: "Brokerage account",
      },
    ]);
  });

  it("prevents add actions when the category reaches the active record limit", () => {
    const assets = Array.from({ length: 20 }, (_, index) => ({
      assetType: "bank_account" as const,
      fields: {
        approximateValueRange: "prefer_not_to_say",
        currency: "AED",
        institutionName: `Bank ${index + 1}`,
        lastFourDigits: `${1000 + index}`,
      },
      id: `bank-${index + 1}`,
      title: `Bank ${index + 1}`,
    }));

    const viewModel = createVaultCategoryListViewModel({
      addHref: "/vault/add-bank-account",
      addLabel: "Add another bank account",
      assetType: "bank_account",
      assets,
      emptyTitle: "No bank accounts yet",
      title: "Bank accounts",
    });

    expect(viewModel.count).toBe(20);
    expect(viewModel.canAddMore).toBe(false);
  });
});
