import {
  deserializeVaultAssetRow,
  serializeVaultAssetRecord,
  type SupabaseVaultAssetRow,
} from "./supabase-vault-codec";
import type { VaultEncryptedAssetRecord } from "./vault-store";

const VAULT_ASSET_COLUMNS =
  "id, asset_type, ciphertext, nonce, created_at, updated_at, deleted_at";

type SupabaseError = {
  message?: string;
};

type SupabaseResult<T> = {
  data: T;
  error: SupabaseError | null;
};

type VaultAssetTable = {
  delete: () => {
    eq: (column: "id", value: string) => {
      select: (columns: "id") => {
        maybeSingle: () => Promise<SupabaseResult<{ id: string } | null>>;
      };
    };
  };
  select: (columns: typeof VAULT_ASSET_COLUMNS) => {
    order: (
      column: "created_at",
      options: { ascending: true },
    ) => Promise<SupabaseResult<SupabaseVaultAssetRow[]>>;
  };
  update: (values: {
    deleted_at: string | null;
    updated_at: string;
  }) => {
    eq: (column: "id", value: string) => {
      select: (columns: typeof VAULT_ASSET_COLUMNS) => {
        maybeSingle: () => Promise<SupabaseResult<SupabaseVaultAssetRow | null>>;
      };
    };
  };
  upsert: (
    values: Awaited<ReturnType<typeof serializeVaultAssetRecord>>,
    options: { onConflict: "id" },
  ) => {
    select: (columns: typeof VAULT_ASSET_COLUMNS) => {
      single: () => Promise<SupabaseResult<SupabaseVaultAssetRow>>;
    };
  };
};

export type SupabaseVaultClient = {
  from: (table: "vault_assets") => VaultAssetTable;
};

export function createSupabaseVaultRepository(client: SupabaseVaultClient) {
  const table = client.from("vault_assets");

  return {
    async listAssets(): Promise<VaultEncryptedAssetRecord[]> {
      const result = await table
        .select(VAULT_ASSET_COLUMNS)
        .order("created_at", { ascending: true });

      assertSupabaseSuccess(result, "Vault assets could not be loaded.");

      return Promise.all(result.data.map(deserializeVaultAssetRow));
    },
    async permanentlyDeleteAsset(id: string): Promise<boolean> {
      const result = await table.delete().eq("id", id).select("id").maybeSingle();

      assertSupabaseSuccess(result, "Vault asset could not be permanently deleted.");

      return result.data !== null;
    },
    async restoreAsset({
      id,
      updatedAt,
    }: {
      id: string;
      updatedAt: string;
    }): Promise<VaultEncryptedAssetRecord | null> {
      return updateDeletionMetadata({
        deletedAt: null,
        failureMessage: "Vault asset could not be restored.",
        id,
        table,
        updatedAt,
      });
    },
    async saveAsset(record: VaultEncryptedAssetRecord): Promise<VaultEncryptedAssetRecord> {
      const result = await table
        .upsert(await serializeVaultAssetRecord(record), { onConflict: "id" })
        .select(VAULT_ASSET_COLUMNS)
        .single();

      assertSupabaseSuccess(result, "Vault asset could not be saved.");

      return deserializeVaultAssetRow(result.data);
    },
    async softDeleteAsset({
      deletedAt,
      id,
      updatedAt,
    }: {
      deletedAt: string;
      id: string;
      updatedAt: string;
    }): Promise<VaultEncryptedAssetRecord | null> {
      return updateDeletionMetadata({
        deletedAt,
        failureMessage: "Vault asset could not be soft deleted.",
        id,
        table,
        updatedAt,
      });
    },
  };
}

async function updateDeletionMetadata({
  deletedAt,
  failureMessage,
  id,
  table,
  updatedAt,
}: {
  deletedAt: string | null;
  failureMessage: string;
  id: string;
  table: VaultAssetTable;
  updatedAt: string;
}): Promise<VaultEncryptedAssetRecord | null> {
  const result = await table
    .update({ deleted_at: deletedAt, updated_at: updatedAt })
    .eq("id", id)
    .select(VAULT_ASSET_COLUMNS)
    .maybeSingle();

  assertSupabaseSuccess(result, failureMessage);

  return result.data ? deserializeVaultAssetRow(result.data) : null;
}

function assertSupabaseSuccess<T>(
  result: SupabaseResult<T>,
  fallbackMessage: string,
): asserts result is SupabaseResult<NonNullable<T>> {
  if (result.error) {
    throw new Error(result.error.message ?? fallbackMessage);
  }
}
