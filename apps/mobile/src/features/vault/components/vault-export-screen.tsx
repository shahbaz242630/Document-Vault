import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";

import { defaultAuditLog } from "@/features/auth";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  Card,
  Eyebrow,
  MutedText,
  OutlineButton,
  ScreenHeader,
  SerifTitle,
  Subtitle,
} from "@/shared/ui";

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
      <ScreenHeader />

      <View style={{ gap: 4 }}>
        <Eyebrow>Vault export</Eyebrow>
        <SerifTitle size={28}>Save a local copy</SerifTitle>
      </View>

      <ExportCard
        buttonLabel={isExporting ? "Creating PDF..." : "Download readable PDF"}
        description="Creates a readable PDF from your unlocked vault on this device. Sanduqkin does not receive or email this file. Store it safely."
        disabled={isExporting}
        onPress={confirmReadableExport}
        title="Readable PDF"
      />

      <EncryptedStoragePreview items={previewItems} />
    </View>
  );
}

function EncryptedStoragePreview({
  items,
}: {
  items: ReturnType<typeof createEncryptedStoragePreview>;
}) {
  return (
    <View style={{ gap: 10 }}>
      <SerifTitle size={19}>Encrypted storage preview</SerifTitle>
      <Subtitle style={{ fontSize: 14.5, lineHeight: 22 }}>
        This shows the kind of encrypted data Sanduqkin stores. Without your key,
        it cannot be read by Sanduqkin or someone with database access.
      </Subtitle>
      {items.length > 0 ? (
        items.map((item) => <EncryptedPreviewCard item={item} key={`${item.assetType}-${item.updatedAt}`} />)
      ) : (
        <MutedText style={{ fontSize: 15 }}>
          Encrypted records appear here after remote encrypted records are loaded.
        </MutedText>
      )}
    </View>
  );
}

function EncryptedPreviewCard({
  item,
}: {
  item: ReturnType<typeof createEncryptedStoragePreview>[number];
}) {
  return (
    <Card style={{ gap: 6, padding: 14 }}>
      <Text style={{ color: colors.ink, fontFamily: fonts.sans.medium, fontSize: 15 }}>
        {item.assetType}
      </Text>
      <Text style={previewValueStyle}>ciphertext: {item.ciphertextPreview}</Text>
      <Text style={previewValueStyle}>nonce: {item.noncePreview}</Text>
    </Card>
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
    <Card style={{ gap: 12, padding: 18 }}>
      <Text
        style={{
          color: colors.ink,
          fontFamily: fonts.serif.medium,
          fontSize: 19,
        }}
      >
        {title}
      </Text>
      <Subtitle style={{ fontSize: 14.5, lineHeight: 22 }}>{description}</Subtitle>
      <OutlineButton disabled={disabled} label={buttonLabel} onPress={onPress} />
    </Card>
  );
}

const previewValueStyle = {
  color: colors.inkMuted,
  fontFamily: fonts.mono.regular,
  fontSize: 12.5,
};
