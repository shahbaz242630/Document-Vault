import { type AssetPlaintextPayload } from "./asset-payload";
import {
  createVaultStore,
  type VaultDecryptedAsset,
  type VaultDeletedAsset,
  type VaultEncryptedAssetRecord,
} from "./vault-store";

type VaultStore = ReturnType<typeof createVaultStore>;

export type VaultAssetRepository = {
  listAssets: () => Promise<VaultEncryptedAssetRecord[]>;
  permanentlyDeleteAsset: (id: string) => Promise<boolean>;
  restoreAsset: (input: {
    id: string;
    updatedAt: string;
  }) => Promise<VaultEncryptedAssetRecord | null>;
  saveAsset: (record: VaultEncryptedAssetRecord) => Promise<VaultEncryptedAssetRecord>;
  softDeleteAsset: (input: {
    deletedAt: string;
    id: string;
    updatedAt: string;
  }) => Promise<VaultEncryptedAssetRecord | null>;
};

type CreateVaultSessionOptions = {
  key: Uint8Array;
  repository?: VaultAssetRepository;
  store?: VaultStore;
};

export type VaultSession = {
  addAsset: (payload: AssetPlaintextPayload) => Promise<VaultDecryptedAsset>;
  listActiveAssets: () => Promise<VaultDecryptedAsset[]>;
  listDeletedAssets: () => Promise<VaultDeletedAsset[]>;
  listEncryptedRecords: () => VaultEncryptedAssetRecord[];
  loadPersistedAssets: () => Promise<void>;
  permanentlyDeleteAsset: (id: string) => Promise<boolean>;
  restoreAsset: (id: string) => Promise<VaultEncryptedAssetRecord | null>;
  softDeleteAsset: (id: string) => Promise<VaultEncryptedAssetRecord | null>;
  updateAsset: (id: string, payload: AssetPlaintextPayload) => Promise<VaultDecryptedAsset | null>;
};

export function createVaultSession({
  key,
  repository,
  store = createVaultStore(),
}: CreateVaultSessionOptions): VaultSession {
  return {
    async addAsset(payload) {
      const record = await store.addAsset({ key, payload });
      await repository?.saveAsset(record);

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
    listEncryptedRecords() {
      return store.listEncryptedRecords();
    },
    async loadPersistedAssets() {
      if (!repository) {
        return;
      }

      store.replaceEncryptedRecords(await repository.listAssets());
    },
    async permanentlyDeleteAsset(id) {
      const deleted = store.permanentlyDeleteAsset(id);

      if (deleted) {
        await repository?.permanentlyDeleteAsset(id);
      }

      return deleted;
    },
    async restoreAsset(id) {
      const record = store.restoreAsset(id);

      if (record) {
        await repository?.restoreAsset({
          id,
          updatedAt: record.updatedAt,
        });
      }

      return record;
    },
    async softDeleteAsset(id) {
      const record = store.softDeleteAsset(id);

      if (record?.deletedAt) {
        await repository?.softDeleteAsset({
          deletedAt: record.deletedAt,
          id,
          updatedAt: record.updatedAt,
        });
      }

      return record;
    },
    async updateAsset(id, payload) {
      const record = await store.updateAsset({ id, key, payload });

      if (!record) {
        return null;
      }

      await repository?.saveAsset(record);

      return {
        ...payload,
        id: record.id,
      };
    },
  };
}
