import { useState } from "react";
import { Text, View } from "react-native";
import { getSchemaDrivenVaultCategory } from "@vault/shared-validation";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  Card,
  ErrorText,
  Eyebrow,
  MutedText,
  OutlineButton,
  ScreenHeader,
  SerifTitle,
  TextButton,
} from "@/shared/ui";

import {
  createPermanentDeleteConfirmationState,
  requestPermanentDelete,
} from "../permanent-delete-confirmation";
import type { VaultDecryptedAsset } from "../vault-store";

type AssetDetailViewProps = {
  asset: VaultDecryptedAsset;
  onDelete?: (id: string) => Promise<void>;
  onEdit?: () => void;
};

export function AssetDetailView({ asset, onDelete, onEdit }: AssetDetailViewProps) {
  const [deleteConfirmation, setDeleteConfirmation] = useState(
    createPermanentDeleteConfirmationState,
  );
  const isConfirmingDelete = deleteConfirmation.pendingAssetId === asset.id;

  return (
    <View style={{ flex: 1, gap: 18 }}>
      <ScreenHeader />

      <View style={{ gap: 4 }}>
        <Eyebrow>{getAssetTypeLabel(asset.assetType)}</Eyebrow>
        <SerifTitle size={28}>{asset.title}</SerifTitle>
      </View>

      <AssetFieldsCard asset={asset} />

      <MutedText style={{ fontSize: 13 }}>
        Stored sealed on this device. Decrypted only when you open it.
      </MutedText>

      <View style={{ gap: 12, marginTop: "auto" }}>
        {isConfirmingDelete ? (
          <ErrorText>
            This record will be removed from Sanduqkin and cannot be recovered.
            Sanduqkin cannot restore deleted encrypted vault records.
          </ErrorText>
        ) : null}
        {onEdit ? <OutlineButton label="Edit" onPress={onEdit} /> : null}
        {onDelete ? (
          <TextButton
            color={colors.danger}
            label={isConfirmingDelete ? "Delete permanently" : "Delete this record"}
            onPress={() => {
              const result = requestPermanentDelete({
                assetId: asset.id,
                state: deleteConfirmation,
              });
              setDeleteConfirmation(result.nextState);

              if (result.confirmedAssetId) {
                void onDelete(result.confirmedAssetId);
              }
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

function AssetFieldsCard({ asset }: { asset: VaultDecryptedAsset }) {
  const entries = Object.entries(asset.fields);
  const rows: [string, string][] = entries.map(([key, value]) => [
    key.replace(/([A-Z])/g, " $1").trim(),
    value,
  ]);

  if (asset.notes) {
    rows.push(["Notes", asset.notes]);
  }

  return (
    <Card>
      {rows.map(([label, value], index) => (
        <View
          key={label}
          style={{
            alignItems: "baseline",
            borderBottomColor: colors.divider,
            borderBottomWidth: index === rows.length - 1 ? 0 : 1,
            flexDirection: "row",
            gap: 16,
            justifyContent: "space-between",
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}
        >
          <Text
            style={{
              color: colors.inkMuted,
              fontFamily: fonts.sans.regular,
              fontSize: 13.5,
              textTransform: "capitalize",
            }}
          >
            {label}
          </Text>
          <Text
            selectable
            style={{
              color: colors.ink,
              flexShrink: 1,
              fontFamily: fonts.sans.regular,
              fontSize: 15.5,
              textAlign: "right",
            }}
          >
            {value}
          </Text>
        </View>
      ))}
    </Card>
  );
}

function getAssetTypeLabel(assetType: VaultDecryptedAsset["assetType"]): string {
  return getSchemaDrivenVaultCategory(assetType)?.categoryLabel ?? "Reference";
}
