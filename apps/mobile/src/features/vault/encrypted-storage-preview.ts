import type { VaultEncryptedAssetRecord } from "./vault-store";

export type EncryptedStoragePreviewItem = {
  assetType: string;
  ciphertextPreview: string;
  noncePreview: string;
  storedFields: string[];
  updatedAt: string;
};

const storedFields = ["asset_type", "ciphertext", "nonce", "created_at", "updated_at"];

export function createEncryptedStoragePreview(
  records: VaultEncryptedAssetRecord[],
): EncryptedStoragePreviewItem[] {
  return records.map((record) => ({
    assetType: record.assetType,
    ciphertextPreview: toHexPreview(record.encryptedPayload.ciphertext),
    noncePreview: toHexPreview(record.encryptedPayload.nonce),
    storedFields,
    updatedAt: record.updatedAt,
  }));
}

function toHexPreview(bytes: Uint8Array): string {
  return Array.from(bytes)
    .slice(0, 24)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
