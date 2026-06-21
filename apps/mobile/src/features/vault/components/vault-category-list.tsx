import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import {
  cancelVaultBulkSelection,
  createBulkDeleteConfirmation,
  createVaultBulkSelectionState,
  enterVaultBulkSelection,
  type BulkDeleteMode,
  permanentlyDeleteVaultAssets,
  toggleVaultBulkSelection,
} from "../vault-bulk-selection";
import type { VaultCategoryListViewModel } from "../vault-category-list-view-model";
import { VaultCategoryRecordCard } from "./vault-category-record-card";

type VaultCategoryListProps = {
  onDeleteAsset: (id: string) => Promise<void>;
  viewModel: VaultCategoryListViewModel;
};

export function VaultCategoryList({
  onDeleteAsset,
  viewModel,
}: VaultCategoryListProps) {
  const [isPageMenuOpen, setIsPageMenuOpen] = useState(false);
  const [bulkSelection, setBulkSelection] = useState(createVaultBulkSelectionState);
  const [pendingBulkDeleteMode, setPendingBulkDeleteMode] =
    useState<BulkDeleteMode | null>(null);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const cancelBulkActions = () => {
    setBulkSelection(cancelVaultBulkSelection(bulkSelection));
    setPendingBulkDeleteMode(null);
    setBulkDeleteError(null);
    setIsPageMenuOpen(false);
  };

  const confirmBulkDelete = async () => {
    if (!pendingBulkDeleteMode || isBulkDeleting) {
      return;
    }

    const assetIds = pendingBulkDeleteMode === "all"
      ? viewModel.items.map((item) => item.id)
      : bulkSelection.selectedIds;
    setIsBulkDeleting(true);
    setBulkDeleteError(null);
    const result = await permanentlyDeleteVaultAssets({ assetIds, deleteAsset: onDeleteAsset });
    setIsBulkDeleting(false);

    if (result.failedIds.length > 0) {
      setBulkSelection({ isSelecting: true, selectedIds: result.failedIds });
      setPendingBulkDeleteMode(null);
      setBulkDeleteError("Some records could not be deleted. Try again.");
      return;
    }

    cancelBulkActions();
  };

  const pendingBulkDeleteIds = pendingBulkDeleteMode === "all"
    ? viewModel.items.map((item) => item.id)
    : bulkSelection.selectedIds;

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Vault</Text>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              color: colors.ink,
              flex: 1,
              fontSize: 30,
              fontWeight: "700",
              lineHeight: 36,
            }}
          >
            {viewModel.title}
          </Text>
          {bulkSelection.isSelecting ? (
            <Pressable accessibilityRole="button" onPress={cancelBulkActions}>
              <Text style={{ color: colors.action, fontSize: 16, fontWeight: "700" }}>
                Cancel
              </Text>
            </Pressable>
          ) : viewModel.items.length > 0 ? (
            <Pressable
              accessibilityLabel="Open category actions"
              accessibilityRole="button"
              onPress={() => setIsPageMenuOpen((isOpen) => !isOpen)}
              style={{ alignItems: "center", minHeight: 40, minWidth: 40 }}
            >
              <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "700" }}>...</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={{ color: colors.inkSoft, fontSize: 16 }}>
          {bulkSelection.isSelecting
            ? `${bulkSelection.selectedIds.length} selected`
            : `${viewModel.count} of ${viewModel.limit} saved`}
        </Text>
        {isPageMenuOpen ? (
          <View
            style={{
              alignSelf: "flex-end",
              backgroundColor: "rgba(255,255,255,0.96)",
              borderColor: colors.border,
              borderRadius: 10,
              borderWidth: 1,
              minWidth: 180,
              padding: 8,
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setBulkSelection(enterVaultBulkSelection(bulkSelection));
                setIsPageMenuOpen(false);
                setBulkDeleteError(null);
              }}
              style={{ padding: 10 }}
            >
              <Text style={{ color: colors.action, fontSize: 16, fontWeight: "700" }}>
                Select records
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPendingBulkDeleteMode("all");
                setIsPageMenuOpen(false);
                setBulkDeleteError(null);
              }}
              style={{ padding: 10 }}
            >
              <Text style={{ color: colors.danger, fontSize: 16, fontWeight: "700" }}>
                Delete all
              </Text>
            </Pressable>
          </View>
        ) : null}
        {pendingBulkDeleteMode ? (
          <View style={{ gap: 10, paddingVertical: 8 }}>
            <Text style={{ color: colors.danger, fontSize: 14, lineHeight: 20 }}>
              {createBulkDeleteConfirmation({
                count: pendingBulkDeleteIds.length,
                mode: pendingBulkDeleteMode,
                title: viewModel.title,
              })}
            </Text>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Pressable
                accessibilityRole="button"
                disabled={isBulkDeleting}
                onPress={() => setPendingBulkDeleteMode(null)}
              >
                <Text style={{ color: colors.inkMuted, fontSize: 16, fontWeight: "700" }}>
                  Keep records
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isBulkDeleting}
                onPress={() => void confirmBulkDelete()}
              >
                <Text style={{ color: colors.danger, fontSize: 16, fontWeight: "700" }}>
                  {isBulkDeleting ? "Deleting..." : "Delete permanently"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {bulkDeleteError ? (
          <Text style={{ color: colors.danger, fontSize: 14 }}>{bulkDeleteError}</Text>
        ) : null}
      </View>

      {viewModel.items.length === 0 ? (
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          {viewModel.emptyTitle}
        </Text>
      ) : (
        <View style={{ gap: 12 }}>
          {viewModel.items.map((item) => (
            <VaultCategoryRecordCard
              isSelected={bulkSelection.selectedIds.includes(item.id)}
              isSelecting={bulkSelection.isSelecting}
              item={item}
              key={item.id}
              onDeleteAsset={onDeleteAsset}
              onToggleSelection={(assetId) => {
                setBulkSelection(toggleVaultBulkSelection(bulkSelection, assetId));
                setPendingBulkDeleteMode(null);
                setBulkDeleteError(null);
              }}
            />
          ))}
        </View>
      )}

      {bulkSelection.isSelecting && bulkSelection.selectedIds.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          disabled={isBulkDeleting}
          onPress={() => {
            setPendingBulkDeleteMode("selected");
            setBulkDeleteError(null);
          }}
          style={{
            backgroundColor: colors.danger,
            borderRadius: 10,
            padding: 16,
          }}
        >
          <Text
            style={{
              color: colors.surface,
              fontSize: 17,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            Delete selected
          </Text>
        </Pressable>
      ) : null}

      {!bulkSelection.isSelecting && viewModel.canAddMore ? (
        <Link
          href={viewModel.addHref}
          style={{
            borderColor: colors.action,
            borderCurve: "continuous",
            borderRadius: 10,
            borderStyle: "dashed",
            borderWidth: 1,
            color: colors.action,
            fontSize: 17,
            fontWeight: "700",
            padding: 16,
            textAlign: "center",
          }}
        >
          + {viewModel.addLabel}
        </Link>
      ) : !bulkSelection.isSelecting ? (
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
          This category has reached the 20-record limit.
        </Text>
      ) : null}
    </View>
  );
}
