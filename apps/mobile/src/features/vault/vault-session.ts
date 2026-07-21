import { type AssetPlaintextPayload } from "./asset-payload";
import {
  createVaultStore,
  type VaultDecryptedAsset,
  type VaultDeletedAsset,
  type VaultEncryptedAssetRecord,
} from "./vault-store";
import {
  createSealedEmergencyCodeSetup,
  regenerateSealedEmergencyCodeSetup,
  revokeSealedEmergencyCodeSetup,
  type SealedEmergencyCodeGrantRepository,
  type SealedEmergencyCodeSetupOptions,
  type SealedEmergencyCodeSetupResult,
} from "./sealed-emergency-code-service";

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
  createSealedEmergencyCodeSetup: (
    repository: SealedEmergencyCodeGrantRepository,
    options?: Omit<SealedEmergencyCodeSetupOptions, "mek" | "repository">,
  ) => Promise<SealedEmergencyCodeSetupResult>;
  regenerateSealedEmergencyCodeSetup: (
    repository: SealedEmergencyCodeGrantRepository,
    options?: Omit<SealedEmergencyCodeSetupOptions, "mek" | "repository">,
  ) => Promise<SealedEmergencyCodeSetupResult>;
  revokeSealedEmergencyCodeSetup: (
    repository: Pick<SealedEmergencyCodeGrantRepository, "revokeActiveSealedCodeGrants">,
    options?: { auditLog?: SealedEmergencyCodeSetupOptions["auditLog"] },
  ) => Promise<void>;
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
    addAsset: (payload) => addVaultAsset({ key, payload, repository, store }),
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
    permanentlyDeleteAsset: (id) => permanentlyDeleteVaultAsset({ id, repository, store }),
    createSealedEmergencyCodeSetup(repository, options = {}) {
      return createSealedEmergencyCodeSetup({
        ...options,
        mek: key,
        repository,
      });
    },
    regenerateSealedEmergencyCodeSetup(repository, options = {}) {
      return regenerateSealedEmergencyCodeSetup({
        ...options,
        mek: key,
        repository,
      });
    },
    revokeSealedEmergencyCodeSetup(repository, options = {}) {
      return revokeSealedEmergencyCodeSetup({
        ...options,
        repository,
      });
    },
    restoreAsset: (id) => changeVaultAssetDeletion({ deleted: false, id, repository, store }),
    softDeleteAsset: (id) => changeVaultAssetDeletion({ deleted: true, id, repository, store }),
    updateAsset: (id, payload) => updateVaultAsset({ id, key, payload, repository, store }),
  };
}

type PersistedVaultMutation = {
  repository?: VaultAssetRepository;
  store: VaultStore;
};

async function addVaultAsset({ key, payload, repository, store }: PersistedVaultMutation & {
  key: Uint8Array;
  payload: AssetPlaintextPayload;
}): Promise<VaultDecryptedAsset> {
  const record = await store.addAsset({ key, payload });
  try {
    await repository?.saveAsset(record);
  } catch (error) {
    const reconciled = repository ? await tryReconcileStore(store, repository) : false;
    if (!reconciled) store.permanentlyDeleteAsset(record.id);
    if (!sameEncryptedRecord(store.getEncryptedRecord(record.id), record)) throw error;
  }
  return { ...payload, id: record.id };
}

async function updateVaultAsset({ id, key, payload, repository, store }: PersistedVaultMutation & {
  id: string;
  key: Uint8Array;
  payload: AssetPlaintextPayload;
}): Promise<VaultDecryptedAsset | null> {
  const previous = store.getEncryptedRecord(id);
  const record = await store.updateAsset({ id, key, payload });
  if (!record) return null;
  try {
    await repository?.saveAsset(record);
  } catch (error) {
    const reconciled = repository ? await tryReconcileStore(store, repository) : false;
    if (!reconciled && previous) store.replaceEncryptedRecord(previous);
    if (!sameEncryptedRecord(store.getEncryptedRecord(id), record)) throw error;
  }
  return { ...payload, id: record.id };
}

async function permanentlyDeleteVaultAsset({ id, repository, store }: PersistedVaultMutation & { id: string }) {
  const previous = store.getEncryptedRecord(id);
  if (!previous || !store.permanentlyDeleteAsset(id)) return false;
  if (!repository) return true;
  try {
    if (!await repository.permanentlyDeleteAsset(id)) throw new Error("Vault asset was not deleted remotely.");
  } catch (error) {
    const reconciled = await tryReconcileStore(store, repository);
    if (!reconciled) store.replaceEncryptedRecord(previous);
    if (store.getEncryptedRecord(id)) throw error;
  }
  return true;
}

async function changeVaultAssetDeletion({ deleted, id, repository, store }: PersistedVaultMutation & {
  deleted: boolean;
  id: string;
}) {
  const previous = store.getEncryptedRecord(id);
  const record = deleted ? store.softDeleteAsset(id) : store.restoreAsset(id);
  if (!record || (deleted && !record.deletedAt)) return null;
  if (!repository) return record;
  try {
    const persisted = deleted
      ? await repository.softDeleteAsset({ deletedAt: record.deletedAt!, id, updatedAt: record.updatedAt })
      : await repository.restoreAsset({ id, updatedAt: record.updatedAt });
    if (!persisted) throw new Error("Vault asset deletion state was not persisted.");
  } catch (error) {
    const reconciled = await tryReconcileStore(store, repository);
    if (!reconciled && previous) store.replaceEncryptedRecord(previous);
    const current = store.getEncryptedRecord(id);
    if (!current || current.deletedAt !== record.deletedAt) throw error;
    return current;
  }
  return record;
}

async function tryReconcileStore(store: VaultStore, repository: VaultAssetRepository) {
  try {
    store.replaceEncryptedRecords(await repository.listAssets());
    return true;
  } catch {
    return false;
  }
}

function sameEncryptedRecord(left: VaultEncryptedAssetRecord | null, right: VaultEncryptedAssetRecord) {
  return Boolean(left && left.assetType === right.assetType && left.id === right.id &&
    left.createdAt === right.createdAt && left.updatedAt === right.updatedAt && left.deletedAt === right.deletedAt &&
    equalBytes(left.encryptedPayload.ciphertext, right.encryptedPayload.ciphertext) &&
    equalBytes(left.encryptedPayload.nonce, right.encryptedPayload.nonce));
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
