import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { defaultAuditLog } from "@/features/auth";
import { colors } from "@/shared/theme/colors";

import { createEncryptedStoragePreview } from "../encrypted-storage-preview";
import { createVaultExportModel } from "../vault-export-model";
import { exportVaultPdf } from "../vault-pdf-exporter";
import { renderVaultPdfHtml } from "../vault-pdf-template";
import type { VaultDecryptedAsset, VaultEncryptedAssetRecord } from "../vault-store";

type VaultExportScreenProps = {
  assets: VaultDecryptedAsset[];
  encryptedRecords?: VaultEncryptedAssetRecord[];
  isReady: boolean;
};

export function VaultExportScreen({
  assets,
  encryptedRecords = [],
  isReady,
}: VaultExportScreenProps) {
  const [isExporting, setIsExporting] = useState(false);
  const previewItems = useMemo(
    () => createEncryptedStoragePreview(encryptedRecords),
    [encryptedRecords],
  );

  async function confirmReadableExport() {
    if (!isReady) {
      Alert.alert("Unlock required", "Unlock your vault before creating a PDF.");
      return;
    }

    Alert.alert(
      "Sensitive PDF",
      "This PDF will contain sensitive information from your vault. Anyone with the file may be able to read it. Store it safely and delete it when no longer needed.",
      [
        { style: "cancel", text: "Cancel" },
        { onPress: () => void createReadableExport(), text: "Create PDF" },
      ],
    );
  }

  async function createReadableExport() {
    setIsExporting(true);
    try {
      const model = createVaultExportModel({ assets, exportedAt: new Date() });
      await exportVaultPdf({ html: renderVaultPdfHtml(model) });
      defaultAuditLog.log({
        deviceInfo: "React Native",
        eventType: "vault_pdf_export_created",
      });
    } catch {
      Alert.alert("Export failed", "We could not create the PDF on this device.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Vault export</Text>
        <Text style={{ color: colors.ink, fontSize: 28, fontWeight: "700" }}>
          Save a local copy
        </Text>
      </View>

      <ExportCard
        buttonLabel={isExporting ? "Creating PDF..." : "Download readable PDF"}
        description="Creates a readable PDF from your unlocked vault on this device. Sanduqkin does not receive or email this file. Store it safely."
        disabled={isExporting}
        onPress={confirmReadableExport}
        title="Readable PDF"
      />

      <View style={{ gap: 10 }}>
        <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}>
          Encrypted storage preview
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 15, lineHeight: 22 }}>
          This shows the kind of encrypted data Sanduqkin stores. Without your key,
          it cannot be read by Sanduqkin or someone with database access.
        </Text>
        {previewItems.length > 0 ? (
          previewItems.map((item) => (
            <View
              key={`${item.assetType}-${item.updatedAt}`}
              style={{
                borderColor: colors.border,
                borderRadius: 8,
                borderWidth: 1,
                gap: 6,
                padding: 12,
              }}
            >
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
                {item.assetType}
              </Text>
              <Text style={{ color: colors.inkMuted, fontSize: 13 }}>
                ciphertext: {item.ciphertextPreview}
              </Text>
              <Text style={{ color: colors.inkMuted, fontSize: 13 }}>
                nonce: {item.noncePreview}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
            Encrypted records appear here after remote encrypted records are loaded.
          </Text>
        )}
      </View>
    </View>
  );
}

function ExportCard({
  buttonLabel,
  description,
  disabled,
  onPress,
  title,
}: {
  buttonLabel: string;
  description: string;
  disabled: boolean;
  onPress: () => void;
  title: string;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        gap: 12,
        padding: 16,
      }}
    >
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: colors.inkSoft, fontSize: 15, lineHeight: 22 }}>
        {description}
      </Text>
      <Pressable disabled={disabled} onPress={onPress}>
        <Text style={{ color: disabled ? colors.inkMuted : colors.action, fontSize: 16 }}>
          {buttonLabel}
        </Text>
      </Pressable>
    </View>
  );
}
