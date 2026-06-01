import {
  deserializeVaultKeyMaterial,
  serializeVaultKeyMaterial,
  type SupabaseVaultKeyMaterialRow,
  type VaultKeyMaterial,
} from "./supabase-vault-codec";

const KEY_MATERIAL_COLUMNS =
  "wrapped_mek_ciphertext, wrapped_mek_nonce, kek_salt, kdf_algorithm, kdf_params, recovery_version";

type SupabaseError = {
  message?: string;
};

type SupabaseResult<T> = {
  data: T;
  error: SupabaseError | null;
};

type KeyMaterialTable = {
  select: (columns: typeof KEY_MATERIAL_COLUMNS) => {
    maybeSingle: () => Promise<SupabaseResult<SupabaseVaultKeyMaterialRow | null>>;
  };
  upsert: (
    values: SupabaseVaultKeyMaterialRow,
    options: { onConflict: "user_id" },
  ) => {
    select: (columns: typeof KEY_MATERIAL_COLUMNS) => {
      single: () => Promise<SupabaseResult<SupabaseVaultKeyMaterialRow>>;
    };
  };
};

export type SupabaseKeyMaterialClient = {
  from: (table: "vault_key_material") => KeyMaterialTable;
};

export function createSupabaseKeyMaterialRepository(
  client: SupabaseKeyMaterialClient,
) {
  const table = client.from("vault_key_material");

  return {
    async loadKeyMaterial(): Promise<VaultKeyMaterial | null> {
      const result = await table.select(KEY_MATERIAL_COLUMNS).maybeSingle();

      assertSupabaseSuccess(result, "Vault key material could not be loaded.");

      return result.data ? deserializeVaultKeyMaterial(result.data) : null;
    },
    async saveKeyMaterial(keyMaterial: VaultKeyMaterial): Promise<VaultKeyMaterial> {
      const result = await table
        .upsert(await serializeVaultKeyMaterial(keyMaterial), { onConflict: "user_id" })
        .select(KEY_MATERIAL_COLUMNS)
        .single();

      assertSupabaseSuccess(result, "Vault key material could not be saved.");

      return deserializeVaultKeyMaterial(result.data);
    },
  };
}

function assertSupabaseSuccess<T>(
  result: SupabaseResult<T>,
  fallbackMessage: string,
): asserts result is SupabaseResult<NonNullable<T>> {
  if (result.error) {
    throw new Error(result.error.message ?? fallbackMessage);
  }
}
