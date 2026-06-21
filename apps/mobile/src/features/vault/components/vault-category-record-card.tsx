import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import {
  createPermanentDeleteConfirmationState,
  requestPermanentDelete,
} from "../permanent-delete-confirmation";
import type { VaultCategoryListItem } from "../vault-category-list-view-model";

type VaultCategoryRecordCardProps = {
  isSelected: boolean;
  isSelecting: boolean;
  item: VaultCategoryListItem;
  onDeleteAsset: (id: string) => Promise<void>;
  onToggleSelection: (id: string) => void;
};

export function VaultCategoryRecordCard({
  isSelected,
  isSelecting,
  item,
  onDeleteAsset,
  onToggleSelection,
}: VaultCategoryRecordCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(
    createPermanentDeleteConfirmationState,
  );
  const isConfirmingDelete = deleteConfirmation.pendingAssetId === item.id;

  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.88)",
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 10,
        borderWidth: 1,
        gap: 10,
        padding: 16,
        shadowColor: "#102820",
        shadowOffset: { height: 4, width: 0 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      }}
    >
      {isSelecting ? (
        <SelectableRecordContent
          isSelected={isSelected}
          item={item}
          onPress={() => onToggleSelection(item.id)}
        />
      ) : (
        <RegularRecordContent
          isMenuOpen={isMenuOpen}
          item={item}
          onToggleMenu={() => {
            setIsMenuOpen((isOpen) => !isOpen);
            setDeleteConfirmation(createPermanentDeleteConfirmationState());
          }}
        />
      )}

      {!isSelecting && isMenuOpen ? (
        <RecordActionMenu
          isConfirmingDelete={isConfirmingDelete}
          item={item}
          onDeleteRequest={() => {
            const result = requestPermanentDelete({ assetId: item.id, state: deleteConfirmation });
            setDeleteConfirmation(result.nextState);
            if (result.confirmedAssetId) {
              setIsMenuOpen(false);
              void onDeleteAsset(result.confirmedAssetId);
            }
          }}
        />
      ) : null}
    </View>
  );
}

function SelectableRecordContent({
  isSelected,
  item,
  onPress,
}: {
  isSelected: boolean;
  item: VaultCategoryListItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${isSelected ? "Deselect" : "Select"} ${item.title}`}
      accessibilityRole="checkbox"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={{ alignItems: "center", flexDirection: "row", gap: 12 }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: isSelected ? colors.action : "transparent",
          borderColor: isSelected ? colors.action : colors.border,
          borderRadius: 11,
          borderWidth: 2,
          height: 22,
          justifyContent: "center",
          width: 22,
        }}
      >
        {isSelected ? (
          <Text style={{ color: colors.surface, fontSize: 14, fontWeight: "700" }}>✓</Text>
        ) : null}
      </View>
      <RecordText item={item} />
    </Pressable>
  );
}

function RegularRecordContent({
  isMenuOpen,
  item,
  onToggleMenu,
}: {
  isMenuOpen: boolean;
  item: VaultCategoryListItem;
  onToggleMenu: () => void;
}) {
  return (
    <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12 }}>
      <Link href={{ pathname: "/vault/[id]", params: { id: item.id } }} style={{ flex: 1 }}>
        <RecordText item={item} />
      </Link>
      <Pressable
        accessibilityLabel={`Open actions for ${item.title}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isMenuOpen }}
        onPress={onToggleMenu}
        style={{ alignItems: "center", justifyContent: "center", minHeight: 40, minWidth: 40 }}
      >
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "700" }}>...</Text>
      </Pressable>
    </View>
  );
}

function RecordText({ item }: { item: VaultCategoryListItem }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700" }}>{item.title}</Text>
      {item.summary ? (
        <Text style={{ color: colors.inkMuted, fontSize: 15, marginTop: 4 }}>{item.summary}</Text>
      ) : null}
    </View>
  );
}

function RecordActionMenu({
  isConfirmingDelete,
  item,
  onDeleteRequest,
}: {
  isConfirmingDelete: boolean;
  item: VaultCategoryListItem;
  onDeleteRequest: () => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Link
        href={{ pathname: "/vault/edit-asset", params: { id: item.id } }}
        style={{ color: colors.action, fontSize: 16, fontWeight: "700", paddingVertical: 8 }}
      >
        Edit
      </Link>
      {isConfirmingDelete ? (
        <Text style={{ color: colors.danger, fontSize: 14, lineHeight: 20 }}>
          This record will be removed from Sanduqkin and cannot be recovered. Sanduqkin cannot
          restore deleted encrypted vault records.
        </Text>
      ) : null}
      <Pressable accessibilityRole="button" onPress={onDeleteRequest} style={{ paddingVertical: 8 }}>
        <Text style={{ color: colors.danger, fontSize: 16, fontWeight: "700" }}>
          {isConfirmingDelete ? "Delete permanently" : "Delete"}
        </Text>
      </Pressable>
    </View>
  );
}
