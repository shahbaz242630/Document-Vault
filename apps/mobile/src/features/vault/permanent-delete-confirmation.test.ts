import { describe, expect, it } from "vitest";

import {
  createPermanentDeleteConfirmationState,
  requestPermanentDelete,
} from "./permanent-delete-confirmation";

describe("permanent delete confirmation", () => {
  it("requires confirmation before permanently deleting an item", () => {
    const firstRequest = requestPermanentDelete({
      assetId: "asset-1",
      state: createPermanentDeleteConfirmationState(),
    });

    expect(firstRequest).toEqual({
      confirmedAssetId: null,
      nextState: { pendingAssetId: "asset-1" },
      requiresConfirmation: true,
    });

    const secondRequest = requestPermanentDelete({
      assetId: "asset-1",
      state: firstRequest.nextState,
    });

    expect(secondRequest).toEqual({
      confirmedAssetId: "asset-1",
      nextState: { pendingAssetId: null },
      requiresConfirmation: false,
    });
  });

  it("switches pending confirmation when a different item is selected", () => {
    const firstRequest = requestPermanentDelete({
      assetId: "asset-1",
      state: { pendingAssetId: "asset-2" },
    });

    expect(firstRequest).toEqual({
      confirmedAssetId: null,
      nextState: { pendingAssetId: "asset-1" },
      requiresConfirmation: true,
    });
  });
});
