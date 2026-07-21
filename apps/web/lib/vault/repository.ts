import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssetType } from "@vault/shared-types";

import type { EncryptedAssetV1, WrappedKeyMaterialV1 } from "./crypto";

const ASSET_COLUMNS = "id,asset_type,ciphertext,nonce,created_at,updated_at,deleted_at";
const KEY_COLUMNS = "kdf_algorithm,kdf_params,kek_salt,wrapped_mek_ciphertext,wrapped_mek_nonce";

export type WebVaultAssetRecord = EncryptedAssetV1 & {
  createdAt: string;
  deletedAt: string | null;
  id: string;
  updatedAt: string;
};

export function createWebVaultRepository(client: SupabaseClient) {
  return {
    async loadKeyMaterial(): Promise<WrappedKeyMaterialV1 | null> {
      const { data, error } = await client.from("vault_key_material").select(KEY_COLUMNS).maybeSingle();
      if (error) throw new Error("Vault key material could not be loaded.");
      if (!data) return null;
      return {
        kdfAlgorithm: data.kdf_algorithm,
        kdfParams: data.kdf_params,
        kekSalt: data.kek_salt,
        wrappedMekCiphertext: data.wrapped_mek_ciphertext,
        wrappedMekNonce: data.wrapped_mek_nonce,
      } as WrappedKeyMaterialV1;
    },
    async listAssets(assetType: AssetType): Promise<WebVaultAssetRecord[]> {
      const { data, error } = await client
        .from("vault_assets")
        .select(ASSET_COLUMNS)
        .eq("asset_type", assetType)
        .order("created_at", { ascending: true });
      if (error) throw new Error("Vault records could not be loaded.");
      return (data ?? []).map(fromRow);
    },
    async save(record: WebVaultAssetRecord): Promise<void> {
      const { error } = await client.from("vault_assets").upsert({
        id: record.id,
        asset_type: record.assetType,
        ciphertext: record.ciphertext,
        nonce: record.nonce,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
        deleted_at: record.deletedAt,
      }, { onConflict: "id" });
      if (error) throw new Error("Vault record could not be saved.");
    },
    async setDeletedAt(id: string, deletedAt: string | null): Promise<void> {
      const { error } = await client.from("vault_assets").update({
        deleted_at: deletedAt,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw new Error(deletedAt ? "Vault record could not be deleted." : "Vault record could not be restored.");
    },
    async permanentlyDelete(id: string): Promise<void> {
      const { error } = await client.from("vault_assets").delete().eq("id", id);
      if (error) throw new Error("Vault record could not be permanently deleted.");
    },
  };
}

function fromRow(row: Record<string, unknown>): WebVaultAssetRecord {
  return {
    assetType: String(row.asset_type),
    ciphertext: String(row.ciphertext),
    createdAt: String(row.created_at),
    deletedAt: row.deleted_at === null ? null : String(row.deleted_at),
    id: String(row.id),
    nonce: String(row.nonce),
    updatedAt: String(row.updated_at),
  };
}
