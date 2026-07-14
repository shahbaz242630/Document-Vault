import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  BackChevron,
  EmptyStateCard,
  ErrorText,
  MutedText,
  PrimaryButton,
  SerifTitle,
} from "@/shared/ui";

import {
  cancelVaultBulkSelection,
  createBulkDeleteConfirmation,
  createVaultBulkSelectionState,
  enterVaultBulkSelection,
  type BulkDeleteMode,
  permanentlyDeleteVaultAssets,
  toggleVaultBulkSelection,
  type VaultBulkSelectionState,
} from "../vault-bulk-selection";
import type { VaultCategoryListViewModel } from "../vault-category-list-view-model";
import { VaultCategoryRecordCard } from "./vault-category-record-card";

type VaultCategoryListProps = {
  onDeleteAsset: (id: string) => Promise<void>;
  viewModel: VaultCategoryListViewModel;
};

type VaultCategoryItem = VaultCategoryListViewModel["items"][number];

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
    if (!pendingBulkDeleteMode || isBulkDeleting) return;

    const assetIds = getPendingBulkDeleteIds({
      bulkSelection,
      mode: pendingBulkDeleteMode,
      viewModel,
    });
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

  const pendingBulkDeleteIds = getPendingBulkDeleteIds({
    bulkSelection,
    mode: pendingBulkDeleteMode,
    viewModel,
  });

  return (
    <View style={{ flex: 1, gap: 18 }}>
      <VaultCategoryHeader
        bulkDeleteError={bulkDeleteError}
        bulkSelection={bulkSelection}
        isBulkDeleting={isBulkDeleting}
        isPageMenuOpen={isPageMenuOpen}
        onCancelBulkActions={cancelBulkActions}
        onCloseBulkConfirmation={() => setPendingBulkDeleteMode(null)}
        onConfirmBulkDelete={() => {
          void confirmBulkDelete();
        }}
        onDeleteAll={() => {
          setPendingBulkDeleteMode("all");
          setIsPageMenuOpen(false);
          setBulkDeleteError(null);
        }}
        onSelectRecords={() => {
          setBulkSelection(enterVaultBulkSelection(bulkSelection));
          setIsPageMenuOpen(false);
          setBulkDeleteError(null);
        }}
        onToggleMenu={() => setIsPageMenuOpen((isOpen) => !isOpen)}
        pendingBulkDeleteIds={pendingBulkDeleteIds}
        pendingBulkDeleteMode={pendingBulkDeleteMode}
        viewModel={viewModel}
      />

      <VaultCategoryRecords
        bulkSelection={bulkSelection}
        items={viewModel.items}
        onDeleteAsset={onDeleteAsset}
        onToggleSelection={(assetId) => {
          setBulkSelection(toggleVaultBulkSelection(bulkSelection, assetId));
          setPendingBulkDeleteMode(null);
          setBulkDeleteError(null);
        }}
        viewModel={viewModel}
      />

      <VaultCategoryFooter
        bulkSelection={bulkSelection}
        isBulkDeleting={isBulkDeleting}
        onDeleteSelected={() => {
          setPendingBulkDeleteMode("selected");
          setBulkDeleteError(null);
        }}
        viewModel={viewModel}
      />
    </View>
  );
}

function getPendingBulkDeleteIds({
  bulkSelection,
  mode,
  viewModel,
}: {
  bulkSelection: VaultBulkSelectionState;
  mode: BulkDeleteMode | null;
  viewModel: VaultCategoryListViewModel;
}) {
  return mode === "all" ? viewModel.items.map((item) => item.id) : bulkSelection.selectedIds;
}

function VaultCategoryHeader({
  bulkDeleteError,
  bulkSelection,
  isBulkDeleting,
  isPageMenuOpen,
  onCancelBulkActions,
  onCloseBulkConfirmation,
  onConfirmBulkDelete,
  onDeleteAll,
  onSelectRecords,
  onToggleMenu,
  pendingBulkDeleteIds,
  pendingBulkDeleteMode,
  viewModel,
}: {
  bulkDeleteError: string | null;
  bulkSelection: VaultBulkSelectionState;
  isBulkDeleting: boolean;
  isPageMenuOpen: boolean;
  onCancelBulkActions: () => void;
  onCloseBulkConfirmation: () => void;
  onConfirmBulkDelete: () => void;
  onDeleteAll: () => void;
  onSelectRecords: () => void;
  onToggleMenu: () => void;
  pendingBulkDeleteIds: string[];
  pendingBulkDeleteMode: BulkDeleteMode | null;
  viewModel: VaultCategoryListViewModel;
}) {
  return (
    <View style={{ gap: 6 }}>
      <VaultCategoryTitleRow
        bulkSelection={bulkSelection}
        onCancelBulkActions={onCancelBulkActions}
        onToggleMenu={onToggleMenu}
        viewModel={viewModel}
      />
      <MutedText>
        {bulkSelection.isSelecting
          ? `${bulkSelection.selectedIds.length} selected`
          : `${viewModel.count} of ${viewModel.limit} saved`}
      </MutedText>
      {isPageMenuOpen ? (
        <VaultCategoryPageMenu onDeleteAll={onDeleteAll} onSelectRecords={onSelectRecords} />
      ) : null}
      {pendingBulkDeleteMode ? (
        <VaultCategoryBulkConfirmation
          count={pendingBulkDeleteIds.length}
          isBulkDeleting={isBulkDeleting}
          mode={pendingBulkDeleteMode}
          onCancel={onCloseBulkConfirmation}
          onConfirm={onConfirmBulkDelete}
          title={viewModel.title}
        />
      ) : null}
      {bulkDeleteError ? <ErrorText>{bulkDeleteError}</ErrorText> : null}
    </View>
  );
}

function VaultCategoryTitleRow({
  bulkSelection,
  onCancelBulkActions,
  onToggleMenu,
  viewModel,
}: {
  bulkSelection: VaultBulkSelectionState;
  onCancelBulkActions: () => void;
  onToggleMenu: () => void;
  viewModel: VaultCategoryListViewModel;
}) {
  return (
    <>
      <View style={{ marginBottom: 12 }}>
        <BackChevron />
      </View>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <SerifTitle size={28} style={{ flex: 1 }}>
          {viewModel.title}
        </SerifTitle>
        <VaultCategoryHeaderAction
          bulkSelection={bulkSelection}
          hasItems={viewModel.items.length > 0}
          onCancelBulkActions={onCancelBulkActions}
          onToggleMenu={onToggleMenu}
        />
      </View>
    </>
  );
}

function VaultCategoryHeaderAction({
  bulkSelection,
  hasItems,
  onCancelBulkActions,
  onToggleMenu,
}: {
  bulkSelection: VaultBulkSelectionState;
  hasItems: boolean;
  onCancelBulkActions: () => void;
  onToggleMenu: () => void;
}) {
  if (bulkSelection.isSelecting) {
    return (
      <Pressable accessibilityRole="button" onPress={onCancelBulkActions}>
        <Text style={{ color: colors.action, fontSize: 16, fontWeight: "700" }}>
          Cancel
        </Text>
      </Pressable>
    );
  }

  if (!hasItems) return null;

  return (
    <Pressable
      accessibilityLabel="Open category actions"
      accessibilityRole="button"
      onPress={onToggleMenu}
      style={{ alignItems: "center", minHeight: 40, minWidth: 40 }}
    >
      <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "700" }}>...</Text>
    </Pressable>
  );
}

function VaultCategoryPageMenu({
  onDeleteAll,
  onSelectRecords,
}: {
  onDeleteAll: () => void;
  onSelectRecords: () => void;
}) {
  return (
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
      <VaultCategoryMenuItem label="Select records" onPress={onSelectRecords} tone="action" />
      <VaultCategoryMenuItem label="Delete all" onPress={onDeleteAll} tone="danger" />
    </View>
  );
}

function VaultCategoryMenuItem({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone: "action" | "danger";
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ padding: 10 }}>
      <Text
        style={{
          color: tone === "action" ? colors.action : colors.danger,
          fontSize: 16,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function VaultCategoryBulkConfirmation({
  count,
  isBulkDeleting,
  mode,
  onCancel,
  onConfirm,
  title,
}: {
  count: number;
  isBulkDeleting: boolean;
  mode: BulkDeleteMode;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <View style={{ gap: 10, paddingVertical: 8 }}>
      <Text style={{ color: colors.danger, fontSize: 14, lineHeight: 20 }}>
        {createBulkDeleteConfirmation({ count, mode, title })}
      </Text>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <Pressable
          accessibilityRole="button"
          disabled={isBulkDeleting}
          onPress={onCancel}
        >
          <Text style={{ color: colors.inkMuted, fontSize: 16, fontWeight: "700" }}>
            Keep records
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isBulkDeleting}
          onPress={onConfirm}
        >
          <Text style={{ color: colors.danger, fontSize: 16, fontWeight: "700" }}>
            {isBulkDeleting ? "Deleting..." : "Delete permanently"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function VaultCategoryRecords({
  bulkSelection,
  items,
  onDeleteAsset,
  onToggleSelection,
  viewModel,
}: {
  bulkSelection: VaultBulkSelectionState;
  items: VaultCategoryItem[];
  onDeleteAsset: (id: string) => Promise<void>;
  onToggleSelection: (assetId: string) => void;
  viewModel: VaultCategoryListViewModel;
}) {
  if (items.length === 0) {
    return (
      <EmptyStateCard
        description="Add where it lives — not the thing itself. Your family only needs to know where to look."
        title={viewModel.emptyTitle}
      />
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {items.map((item) => (
        <VaultCategoryRecordCard
          isSelected={bulkSelection.selectedIds.includes(item.id)}
          isSelecting={bulkSelection.isSelecting}
          item={item}
          key={item.id}
          onDeleteAsset={onDeleteAsset}
          onToggleSelection={onToggleSelection}
        />
      ))}
    </View>
  );
}

function VaultCategoryFooter({
  bulkSelection,
  isBulkDeleting,
  onDeleteSelected,
  viewModel,
}: {
  bulkSelection: VaultBulkSelectionState;
  isBulkDeleting: boolean;
  onDeleteSelected: () => void;
  viewModel: VaultCategoryListViewModel;
}) {
  if (bulkSelection.isSelecting && bulkSelection.selectedIds.length > 0) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={isBulkDeleting}
        onPress={onDeleteSelected}
        style={({ pressed }) => ({
          backgroundColor: colors.danger,
          borderCurve: "continuous",
          borderRadius: 10,
          marginTop: "auto",
          opacity: pressed ? 0.85 : 1,
          padding: 16,
        })}
      >
        <Text
          style={{
            color: colors.actionText,
            fontFamily: fonts.sans.semibold,
            fontSize: 17,
            textAlign: "center",
          }}
        >
          Delete selected
        </Text>
      </Pressable>
    );
  }

  if (bulkSelection.isSelecting) return null;
  if (viewModel.canAddMore) return <VaultCategoryAddButton viewModel={viewModel} />;

  return (
    <MutedText style={{ fontSize: 15 }}>
      This category has reached the 20-record limit.
    </MutedText>
  );
}

function VaultCategoryAddButton({
  viewModel,
}: {
  viewModel: VaultCategoryListViewModel;
}) {
  const router = useRouter();

  return (
    <View style={{ marginTop: "auto" }}>
      <PrimaryButton
        label={viewModel.addLabel}
        onPress={() => router.push(viewModel.addHref)}
      />
    </View>
  );
}
