import {
  decryptAssetPayload,
  encryptAssetPayload,
  type AssetPlaintextPayload,
  type EncryptedAssetPayload,
} from "./asset-payload";

export type VaultEncryptedAssetRecord = {
  assetType: AssetPlaintextPayload["assetType"];
  createdAt: string;
  deletedAt: string | null;
  encryptedPayload: EncryptedAssetPayload;
  id: string;
  updatedAt: string;
};

export type VaultDecryptedAsset = AssetPlaintextPayload & {
  id: string;
};

export type VaultDeletedAsset = VaultDecryptedAsset & {
  deletedAt: string;
};

type CreateVaultStoreOptions = {
  generateId?: () => string;
  now?: () => Date;
};

type AddAssetInput = {
  key: Uint8Array;
  payload: AssetPlaintextPayload;
};

type ListActiveAssetsInput = {
  key: Uint8Array;
};

type UpdateAssetInput = {
  id: string;
  key: Uint8Array;
  payload: AssetPlaintextPayload;
};

export function createVaultStore({
  generateId = createLocalIdGenerator(),
  now = () => new Date(),
}: CreateVaultStoreOptions = {}) {
  const records = new Map<string, VaultEncryptedAssetRecord>();

  return {
    async addAsset({ key, payload }: AddAssetInput): Promise<VaultEncryptedAssetRecord> {
      const encryptedPayload = await encryptAssetPayload({ key, payload });
      const timestamp = now().toISOString();
      const record: VaultEncryptedAssetRecord = {
        assetType: encryptedPayload.assetType,
        createdAt: timestamp,
        deletedAt: null,
        encryptedPayload,
        id: generateId(),
        updatedAt: timestamp,
      };

      records.set(record.id, cloneEncryptedRecord(record));

      return cloneEncryptedRecord(record);
    },
    getEncryptedRecord(id: string): VaultEncryptedAssetRecord | null {
      const record = records.get(id);

      return record ? cloneEncryptedRecord(record) : null;
    },
    async listActiveAssets({ key }: ListActiveAssetsInput): Promise<VaultDecryptedAsset[]> {
      const activeRecords = Array.from(records.values()).filter(
        (record) => record.deletedAt === null,
      );

      return Promise.all(activeRecords.map((record) => decryptRecord({ key, record })));
    },
    async listDeletedAssets({ key }: ListActiveAssetsInput): Promise<VaultDeletedAsset[]> {
      const deletedRecords = Array.from(records.values()).filter(
        (record): record is VaultEncryptedAssetRecord & { deletedAt: string } =>
          record.deletedAt !== null,
      );

      return Promise.all(
        deletedRecords.map(async (record) => ({
          ...(await decryptRecord({ key, record })),
          deletedAt: record.deletedAt,
        })),
      );
    },
    listEncryptedRecords(): VaultEncryptedAssetRecord[] {
      return Array.from(records.values()).map(cloneEncryptedRecord);
    },
    permanentlyDeleteAsset(id: string): boolean {
      if (!records.has(id)) {
        return false;
      }

      return records.delete(id);
    },
    restoreAsset(id: string): VaultEncryptedAssetRecord | null {
      const record = records.get(id);

      if (!record) {
        return null;
      }

      const restoredRecord: VaultEncryptedAssetRecord = {
        ...record,
        deletedAt: null,
        updatedAt: now().toISOString(),
      };

      records.set(id, cloneEncryptedRecord(restoredRecord));

      return cloneEncryptedRecord(restoredRecord);
    },
    replaceEncryptedRecords(nextRecords: VaultEncryptedAssetRecord[]): void {
      records.clear();

      for (const record of nextRecords) {
        records.set(record.id, cloneEncryptedRecord(record));
      }
    },
    softDeleteAsset(id: string): VaultEncryptedAssetRecord | null {
      const record = records.get(id);

      if (!record) {
        return null;
      }

      const timestamp = now().toISOString();
      const deletedRecord: VaultEncryptedAssetRecord = {
        ...record,
        deletedAt: timestamp,
        updatedAt: timestamp,
      };

      records.set(id, cloneEncryptedRecord(deletedRecord));

      return cloneEncryptedRecord(deletedRecord);
    },
    async updateAsset({ id, key, payload }: UpdateAssetInput): Promise<VaultEncryptedAssetRecord | null> {
      const record = records.get(id);

      if (!record) {
        return null;
      }

      const encryptedPayload = await encryptAssetPayload({ key, payload });
      const updatedRecord: VaultEncryptedAssetRecord = {
        ...record,
        assetType: encryptedPayload.assetType,
        encryptedPayload,
        updatedAt: now().toISOString(),
      };

      records.set(id, cloneEncryptedRecord(updatedRecord));

      return cloneEncryptedRecord(updatedRecord);
    },
  };
}

async function decryptRecord({
  key,
  record,
}: {
  key: Uint8Array;
  record: VaultEncryptedAssetRecord;
}): Promise<VaultDecryptedAsset> {
  return {
    ...(await decryptAssetPayload({
      encrypted: record.encryptedPayload,
      key,
    })),
    id: record.id,
  };
}

function cloneEncryptedRecord(record: VaultEncryptedAssetRecord): VaultEncryptedAssetRecord {
  return {
    ...record,
    encryptedPayload: {
      ...record.encryptedPayload,
      ciphertext: new Uint8Array(record.encryptedPayload.ciphertext),
      nonce: new Uint8Array(record.encryptedPayload.nonce),
    },
  };
}

function createLocalIdGenerator(): () => string {
  return () => {
    const crypto = globalThis.crypto;

    if (crypto?.randomUUID) {
      return crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = Math.floor(Math.random() * 16);
      const value = char === "x" ? random : (random & 0x3) | 0x8;

      return value.toString(16);
    });
  };
}
