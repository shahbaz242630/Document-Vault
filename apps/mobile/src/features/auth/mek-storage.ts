const MEK_KEY = "vault_mek_base64";

export type SecureStorage = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY?: number;
  deleteItemAsync: (key: string, options?: SecureStorageOptions) => Promise<void>;
  getItemAsync: (key: string, options?: SecureStorageOptions) => Promise<string | null>;
  setItemAsync: (key: string, value: string, options?: SecureStorageOptions) => Promise<void>;
};

type SecureStorageOptions = {
  keychainAccessible?: number;
};

export function createMekStorage(storage: SecureStorage | null) {
  const mekOptions = createMekOptions(storage);

  return {
    async get(): Promise<string | null> {
      if (!storage) return null;
      return storage.getItemAsync(MEK_KEY, mekOptions);
    },
    async set(base64: string): Promise<void> {
      if (!storage) return;
      await storage.setItemAsync(MEK_KEY, base64, mekOptions);
    },
    async clear(): Promise<void> {
      if (!storage) return;
      await storage.deleteItemAsync(MEK_KEY, mekOptions);
    },
  };
}

function createMekOptions(storage: SecureStorage | null): SecureStorageOptions {
  return {
    keychainAccessible: storage?.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
}
