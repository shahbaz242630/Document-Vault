import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import type { VaultDecryptedAsset } from "../vault-store";

type AssetDetailViewProps = {
  asset: VaultDecryptedAsset;
  onDelete?: (id: string) => Promise<void>;
  onEdit?: () => void;
};

export function AssetDetailView({ asset, onDelete, onEdit }: AssetDetailViewProps) {
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
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void onDelete(asset.id);
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
              Delete reference
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function getAssetTypeLabel(assetType: VaultDecryptedAsset["assetType"]): string {
  const labels: Record<string, string> = {
    bank_account: "Bank account",
    contact: "Contact",
    crypto: "Crypto wallet",
    document_location: "Document location",
    insurance: "Insurance",
    investment: "Investment",
    other: "Other",
    pension: "Pension",
    property: "Property",
    subscription: "Subscription",
  };

  return labels[assetType] ?? "Reference";
}
