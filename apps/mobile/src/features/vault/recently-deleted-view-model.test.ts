import { describe, expect, it } from "vitest";

import { createRecentlyDeletedViewModel } from "./recently-deleted-view-model";

describe("createRecentlyDeletedViewModel", () => {
  it("returns an empty state when there are no deleted assets", () => {
    const viewModel = createRecentlyDeletedViewModel([]);

    expect(viewModel).toEqual({
      hasDeletedAssets: false,
      items: [],
      totalCount: 0,
    });
  });

  it("sorts deleted assets by latest deletion first and labels asset types", () => {
    const viewModel = createRecentlyDeletedViewModel([
      {
        assetType: "insurance",
        deletedAt: "2026-05-12T10:00:00.000Z",
        fields: {},
        id: "asset-1",
        title: "Life policy",
      },
      {
        assetType: "bank_account",
        deletedAt: "2026-05-12T11:00:00.000Z",
        fields: {},
        id: "asset-2",
        title: "Primary account",
      },
    ]);

    expect(viewModel).toEqual({
      hasDeletedAssets: true,
      items: [
        {
          assetTypeLabel: "Bank account",
          deletedAtLabel: "Deleted May 12, 2026",
          id: "asset-2",
          title: "Primary account",
        },
        {
          assetTypeLabel: "Insurance",
          deletedAtLabel: "Deleted May 12, 2026",
          id: "asset-1",
          title: "Life policy",
        },
      ],
      totalCount: 2,
    });
  });
});
