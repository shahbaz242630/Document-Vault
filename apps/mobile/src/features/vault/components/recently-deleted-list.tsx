import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import {
  createPermanentDeleteConfirmationState,
  requestPermanentDelete,
} from "../permanent-delete-confirmation";
import { createRecentlyDeletedViewModel } from "../recently-deleted-view-model";
import type { VaultDeletedAsset } from "../vault-store";

type RecentlyDeletedListProps = {
  assets: VaultDeletedAsset[];
  onPermanentlyDeleteAsset?: (id: string) => Promise<void>;
  onRestoreAsset?: (id: string) => Promise<void>;
};

type RecentlyDeletedItem = ReturnType<typeof createRecentlyDeletedViewModel>["items"][number];

export function RecentlyDeletedList({
  assets,
  onPermanentlyDeleteAsset,
  onRestoreAsset,
}: RecentlyDeletedListProps) {
  const viewModel = createRecentlyDeletedViewModel(assets);
  const [deleteConfirmation, setDeleteConfirmation] = useState(
    createPermanentDeleteConfirmationState,
  );

  if (!viewModel.hasDeletedAssets) {
    return <RecentlyDeletedEmptyState />;
  }

  return (
    <View style={{ gap: 20 }}>
      <RecentlyDeletedHeader totalCount={viewModel.totalCount} />
      <View style={{ gap: 10 }}>
        {viewModel.items.map((item) => (
          <RecentlyDeletedCard
            isConfirmingDelete={deleteConfirmation.pendingAssetId === item.id}
            item={item}
            key={item.id}
            onDelete={
              onPermanentlyDeleteAsset
                ? () => {
                    const result = requestPermanentDelete({
                      assetId: item.id,
                      state: deleteConfirmation,
                    });

                    setDeleteConfirmation(result.nextState);

                    if (result.confirmedAssetId) {
                      void onPermanentlyDeleteAsset(result.confirmedAssetId);
                    }
                  }
                : undefined
            }
            onRestore={
              onRestoreAsset
                ? () => {
                    setDeleteConfirmation(createPermanentDeleteConfirmationState());
                    void onRestoreAsset(item.id);
                  }
                : undefined
            }
          />
        ))}
      </View>
    </View>
  );
}

function RecentlyDeletedEmptyState() {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Recently deleted</Text>
      <Text
        style={{
          color: colors.ink,
          fontSize: 30,
          fontWeight: "700",
          lineHeight: 36,
        }}
      >
        Nothing deleted.
      </Text>
      <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
        Soft-deleted records will appear here before permanent removal is added.
      </Text>
    </View>
  );
}

function RecentlyDeletedHeader({ totalCount }: { totalCount: number }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Recently deleted</Text>
      <Text
        style={{
          color: colors.ink,
          fontSize: 30,
          fontWeight: "700",
          lineHeight: 36,
        }}
      >
        {totalCount} deleted item{totalCount === 1 ? "" : "s"}
      </Text>
      <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
        Permanent deletion cannot be undone.
      </Text>
    </View>
  );
}

function RecentlyDeletedCard({
  isConfirmingDelete,
  item,
  onDelete,
  onRestore,
}: {
  isConfirmingDelete: boolean;
  item: RecentlyDeletedItem;
  onDelete?: () => void;
  onRestore?: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 8,
        borderWidth: 1,
        gap: 4,
        padding: 16,
      }}
    >
      <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700" }}>
        {item.title}
      </Text>
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
        {item.assetTypeLabel}
      </Text>
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
        {item.deletedAtLabel}
      </Text>
      {isConfirmingDelete ? (
        <Text style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}>
          Tap confirm to permanently delete this record. This cannot be undone.
        </Text>
      ) : null}
      <RecentlyDeletedActions
        isConfirmingDelete={isConfirmingDelete}
        onDelete={onDelete}
        onRestore={onRestore}
      />
    </View>
  );
}

function RecentlyDeletedActions({
  isConfirmingDelete,
  onDelete,
  onRestore,
}: {
  isConfirmingDelete: boolean;
  onDelete?: () => void;
  onRestore?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {onRestore ? <RecentlyDeletedRestoreButton onRestore={onRestore} /> : null}
      {onDelete ? (
        <RecentlyDeletedDeleteButton
          isConfirmingDelete={isConfirmingDelete}
          onDelete={onDelete}
        />
      ) : null}
    </View>
  );
}

function RecentlyDeletedRestoreButton({ onRestore }: { onRestore: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onRestore}
      style={{
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: colors.action, fontSize: 15, fontWeight: "700" }}>
        Restore
      </Text>
    </Pressable>
  );
}

function RecentlyDeletedDeleteButton({
  isConfirmingDelete,
  onDelete,
}: {
  isConfirmingDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onDelete}
      style={{
        backgroundColor: isConfirmingDelete ? colors.danger : colors.surface,
        borderColor: colors.danger,
        borderCurve: "continuous",
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          color: isConfirmingDelete ? colors.actionText : colors.danger,
          fontSize: 15,
          fontWeight: "700",
        }}
      >
        {isConfirmingDelete ? "Confirm delete forever" : "Delete forever"}
      </Text>
    </Pressable>
  );
}
