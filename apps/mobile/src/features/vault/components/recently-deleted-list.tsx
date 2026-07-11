import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  ErrorText,
  Eyebrow,
  MutedText,
  ScreenHeader,
  SerifTitle,
  Subtitle,
} from "@/shared/ui";

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
      <ScreenHeader />
      <Eyebrow>Recently deleted</Eyebrow>
      <SerifTitle size={28}>Nothing deleted.</SerifTitle>
      <Subtitle>
        Soft-deleted records will appear here before permanent removal is added.
      </Subtitle>
    </View>
  );
}

function RecentlyDeletedHeader({ totalCount }: { totalCount: number }) {
  return (
    <View style={{ gap: 6 }}>
      <ScreenHeader />
      <Eyebrow>Recently deleted</Eyebrow>
      <SerifTitle size={28}>
        {totalCount} deleted item{totalCount === 1 ? "" : "s"}
      </SerifTitle>
      <MutedText>Permanent deletion cannot be undone.</MutedText>
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
        borderRadius: 14,
        borderWidth: 1,
        gap: 4,
        padding: 16,
      }}
    >
      <Text style={{ color: colors.ink, fontFamily: fonts.sans.medium, fontSize: 16 }}>
        {item.title}
      </Text>
      <MutedText>{item.assetTypeLabel}</MutedText>
      <MutedText>{item.deletedAtLabel}</MutedText>
      {isConfirmingDelete ? (
        <ErrorText>
          Tap confirm to permanently delete this record. This cannot be undone.
        </ErrorText>
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
