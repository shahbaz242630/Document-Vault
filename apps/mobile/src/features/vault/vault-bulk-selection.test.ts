import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  cancelVaultBulkSelection,
  createBulkDeleteConfirmation,
  createVaultBulkSelectionState,
  enterVaultBulkSelection,
  permanentlyDeleteVaultAssets,
  toggleVaultBulkSelection,
} from "./vault-bulk-selection";

describe("vault bulk selection", () => {
  it("enters selection mode, toggles records, and cancels", () => {
    const initial = createVaultBulkSelectionState();

    expect(initial).toEqual({ isSelecting: false, selectedIds: [] });

    const selecting = enterVaultBulkSelection(initial);
    expect(selecting).toEqual({ isSelecting: true, selectedIds: [] });

    const oneSelected = toggleVaultBulkSelection(selecting, "asset-1");
    expect(oneSelected).toEqual({ isSelecting: true, selectedIds: ["asset-1"] });

    expect(toggleVaultBulkSelection(oneSelected, "asset-1")).toEqual({
      isSelecting: true,
      selectedIds: [],
    });
    expect(cancelVaultBulkSelection(oneSelected)).toEqual(initial);
  });

  it("keeps selected ids unique and in deterministic toggle order", () => {
    const selecting = enterVaultBulkSelection(createVaultBulkSelectionState());
    const first = toggleVaultBulkSelection(selecting, "asset-2");
    const second = toggleVaultBulkSelection(first, "asset-1");
    const removed = toggleVaultBulkSelection(second, "asset-2");
    const readded = toggleVaultBulkSelection(removed, "asset-2");

    expect(second.selectedIds).toEqual(["asset-2", "asset-1"]);
    expect(readded.selectedIds).toEqual(["asset-1", "asset-2"]);
    expect(new Set(readded.selectedIds).size).toBe(readded.selectedIds.length);
  });

  it("creates explicit confirmation copy for selected and all records", () => {
    expect(
      createBulkDeleteConfirmation({
        count: 2,
        mode: "selected",
        title: "Bank accounts",
      }),
    ).toBe(
      "Delete 2 selected records permanently? These encrypted records cannot be recovered, and Sanduqkin cannot restore them.",
    );
    expect(
      createBulkDeleteConfirmation({
        count: 3,
        mode: "all",
        title: "Bank accounts",
      }),
    ).toBe(
      "Delete all 3 records in Bank accounts permanently? These encrypted records cannot be recovered, and Sanduqkin cannot restore them.",
    );
  });

  it("collects successful and failed permanent deletions without exposing errors", async () => {
    const result = await permanentlyDeleteVaultAssets({
      assetIds: ["asset-1", "asset-2", "asset-3"],
      deleteAsset: async (id) => {
        if (id === "asset-2") {
          throw new Error("network details must not escape");
        }
      },
    });

    expect(result).toEqual({
      deletedIds: ["asset-1", "asset-3"],
      failedIds: ["asset-2"],
    });
    expect(JSON.stringify(result)).not.toContain("network details");
  });

  it("wires bulk actions through the shared category list", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./components/vault-category-list.tsx", import.meta.url)),
      "utf8",
    );

    expect(source).toContain("Select records");
    expect(source).toContain("Delete all");
    expect(source).toContain("Delete selected");
    expect(source).toContain("Cancel");
    expect(source).toContain("permanentlyDeleteVaultAssets");
  });
});
