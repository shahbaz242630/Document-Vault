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

  return (
    <View style={{ gap: 20 }}>
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
          {viewModel.totalCount} deleted item{viewModel.totalCount === 1 ? "" : "s"}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          Permanent deletion cannot be undone.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {viewModel.items.map((item) => (
          <View
            key={item.id}
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
            {deleteConfirmation.pendingAssetId === item.id ? (
              <Text style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}>
                Tap confirm to permanently delete this record. This cannot be undone.
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {onRestoreAsset ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setDeleteConfirmation(createPermanentDeleteConfirmationState());
                    void onRestoreAsset(item.id);
                  }}
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
              ) : null}
              {onPermanentlyDeleteAsset ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const result = requestPermanentDelete({
                      assetId: item.id,
                      state: deleteConfirmation,
                    });

                    setDeleteConfirmation(result.nextState);

                    if (result.confirmedAssetId) {
                      void onPermanentlyDeleteAsset(result.confirmedAssetId);
                    }
                  }}
                  style={{
                    borderColor: colors.danger,
                    backgroundColor:
                      deleteConfirmation.pendingAssetId === item.id
                        ? colors.danger
                        : colors.surface,
                    borderCurve: "continuous",
                    borderRadius: 8,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    style={{
                      color:
                        deleteConfirmation.pendingAssetId === item.id
                          ? colors.actionText
                          : colors.danger,
                      fontSize: 15,
                      fontWeight: "700",
                    }}
                  >
                    {deleteConfirmation.pendingAssetId === item.id
                      ? "Confirm delete forever"
                      : "Delete forever"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
