import { fromBase64, toBase64 } from "@/shared/crypto/vault-crypto";
import type { WrappedMEK } from "@/shared/crypto/mek-wrapping";

import type {
  AssetPlaintextPayload,
  EncryptedAssetPayload,
} from "./asset-payload";
import type { VaultEncryptedAssetRecord } from "./vault-store";

export type SupabaseVaultAssetRow = {
  asset_type: AssetPlaintextPayload["assetType"];
  ciphertext: string;
  created_at: string;
  deleted_at: string | null;
  id: string;
  nonce: string;
  updated_at: string;
};

export type SupabaseVaultAssetInsert = Omit<SupabaseVaultAssetRow, "id"> & {
  id?: string;
};

export type SupabaseVaultKeyMaterialRow = {
  kdf_algorithm: "argon2id";
  kdf_params: {
    keyLength: 32;
    memlimit: 268435456;
    opslimit: 3;
  };
  kek_salt: string;
  recovery_version: number;
  wrapped_mek_ciphertext: string;
  wrapped_mek_nonce: string;
};

export type VaultKeyMaterial = {
  kdfAlgorithm: "argon2id";
  kdfParams: SupabaseVaultKeyMaterialRow["kdf_params"];
  kekSalt: Uint8Array;
  recoveryVersion: number;
  wrappedMek: WrappedMEK;
};

export async function serializeVaultAssetRecord(
  record: VaultEncryptedAssetRecord,
): Promise<SupabaseVaultAssetInsert> {
  return {
    asset_type: record.assetType,
    ciphertext: await toBase64(record.encryptedPayload.ciphertext),
    created_at: record.createdAt,
    deleted_at: record.deletedAt,
    id: record.id,
    nonce: await toBase64(record.encryptedPayload.nonce),
    updated_at: record.updatedAt,
  };
}

export async function deserializeVaultAssetRow(
  row: SupabaseVaultAssetRow,
): Promise<VaultEncryptedAssetRecord> {
  return {
    assetType: row.asset_type,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    encryptedPayload: await deserializeEncryptedPayload(row),
    id: row.id,
    updatedAt: row.updated_at,
  };
}

export async function serializeVaultKeyMaterial(
  keyMaterial: VaultKeyMaterial,
): Promise<SupabaseVaultKeyMaterialRow> {
  return {
    kdf_algorithm: keyMaterial.kdfAlgorithm,
    kdf_params: keyMaterial.kdfParams,
    kek_salt: await toBase64(keyMaterial.kekSalt),
    recovery_version: keyMaterial.recoveryVersion,
    wrapped_mek_ciphertext: await toBase64(keyMaterial.wrappedMek.ciphertext),
    wrapped_mek_nonce: await toBase64(keyMaterial.wrappedMek.nonce),
  };
}

export async function deserializeVaultKeyMaterial(
  row: SupabaseVaultKeyMaterialRow,
): Promise<VaultKeyMaterial> {
  return {
    kdfAlgorithm: row.kdf_algorithm,
    kdfParams: row.kdf_params,
    kekSalt: await fromBase64(row.kek_salt),
    recoveryVersion: row.recovery_version,
    wrappedMek: {
      ciphertext: await fromBase64(row.wrapped_mek_ciphertext),
      nonce: await fromBase64(row.wrapped_mek_nonce),
    },
  };
}

async function deserializeEncryptedPayload(
  row: SupabaseVaultAssetRow,
): Promise<EncryptedAssetPayload> {
  return {
    assetType: row.asset_type,
    ciphertext: await fromBase64(row.ciphertext),
    nonce: await fromBase64(row.nonce),
  };
}
