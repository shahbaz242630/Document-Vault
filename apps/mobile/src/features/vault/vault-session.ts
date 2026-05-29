import { type AssetPlaintextPayload } from "./asset-payload";
import {
  createVaultStore,
  type VaultDecryptedAsset,
  type VaultDeletedAsset,
  type VaultEncryptedAssetRecord,
} from "./vault-store";

type VaultStore = ReturnType<typeof createVaultStore>;

type CreateVaultSessionOptions = {
  key: Uint8Array;
  store?: VaultStore;
};

export type VaultSession = {
  addAsset: (payload: AssetPlaintextPayload) => Promise<VaultDecryptedAsset>;
  listActiveAssets: () => Promise<VaultDecryptedAsset[]>;
  listDeletedAssets: () => Promise<VaultDeletedAsset[]>;
  permanentlyDeleteAsset: (id: string) => boolean;
  restoreAsset: (id: string) => VaultEncryptedAssetRecord | null;
  softDeleteAsset: (id: string) => VaultEncryptedAssetRecord | null;
  updateAsset: (id: string, payload: AssetPlaintextPayload) => Promise<VaultDecryptedAsset | null>;
};

export function createVaultSession({
  key,
  store = createVaultStore(),
}: CreateVaultSessionOptions): VaultSession {
  return {
    async addAsset(payload) {
      const record = await store.addAsset({ key, payload });

      return {
        ...payload,
        id: record.id,
      };
    },
    listActiveAssets() {
      return store.listActiveAssets({ key });
    },
    listDeletedAssets() {
      return store.listDeletedAssets({ key });
    },
    permanentlyDeleteAsset(id) {
      return store.permanentlyDeleteAsset(id);
    },
    restoreAsset(id) {
      return store.restoreAsset(id);
    },
    softDeleteAsset(id) {
      return store.softDeleteAsset(id);
    },
    async updateAsset(id, payload) {
      const record = await store.updateAsset({ id, key, payload });

      if (!record) {
        return null;
      }

      return {
        ...payload,
        id: record.id,
      };
    },
  };
}
