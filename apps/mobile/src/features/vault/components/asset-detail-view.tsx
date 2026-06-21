import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

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
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
          {getAssetTypeLabel(asset.assetType)}
        </Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: 30,
            fontWeight: "700",
            lineHeight: 36,
          }}
        >
          {asset.title}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {Object.entries(asset.fields).map(([key, value]) => (
          <View key={key} style={{ gap: 4 }}>
            <Text style={{ color: colors.inkMuted, fontSize: 13, textTransform: "capitalize" }}>
              {key.replace(/([A-Z])/g, " $1").trim()}
            </Text>
            <Text style={{ color: colors.ink, fontSize: 17 }}>{value}</Text>
          </View>
        ))}
        {asset.notes ? (
          <View key="notes" style={{ gap: 4 }}>
            <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Notes</Text>
            <Text style={{ color: colors.ink, fontSize: 17 }}>{asset.notes}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ gap: 10 }}>
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            onPress={onEdit}
            style={{
              alignItems: "center",
              backgroundColor: colors.action,
              borderCurve: "continuous",
              borderRadius: 8,
              paddingHorizontal: 18,
              paddingVertical: 14,
            }}
          >
            <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
              Edit reference
            </Text>
          </Pressable>
        ) : null}

        {onDelete ? (
          <View style={{ gap: 8 }}>
            {isConfirmingDelete ? (
              <Text style={{ color: colors.danger, fontSize: 14, lineHeight: 20 }}>
                This record will be removed from Sanduqkin and cannot be recovered.
                Sanduqkin cannot restore deleted encrypted vault records.
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
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
              style={{
                alignItems: "center",
                borderColor: colors.danger,
                borderCurve: "continuous",
                borderRadius: 8,
                borderWidth: 1,
                paddingHorizontal: 18,
                paddingVertical: 14,
              }}
            >
              <Text style={{ color: colors.danger, fontSize: 17, fontWeight: "700" }}>
                {isConfirmingDelete ? "Delete permanently" : "Delete reference"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function getAssetTypeLabel(assetType: VaultDecryptedAsset["assetType"]): string {
  const labels: Record<string, string> = {
    bank_account: "Bank account",
    business_interest: "Business interest",
    card: "Card",
    contact: "Contact",
    crypto: "Crypto wallet",
    dependent_pet: "Dependent or pet",
    digital_account: "Digital account",
    document_location: "Document location",
    insurance: "Insurance",
    investment: "Investment",
    loan_debt: "Loan or debt",
    medical_care: "Medical care",
    other: "Other",
    pension: "Pension",
    property: "Property",
    subscription: "Subscription",
    vehicle: "Vehicle",
  };

  return labels[assetType] ?? "Reference";
}
