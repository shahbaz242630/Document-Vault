const MEK_KEY = "vault_mek_base64";

export type SecureStorage = {
  deleteItemAsync: (key: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

export function createMekStorage(storage: SecureStorage | null) {
  return {
    async get(): Promise<string | null> {
      if (!storage) return null;
      return storage.getItemAsync(MEK_KEY);
    },
    async set(base64: string): Promise<void> {
      if (!storage) return;
      await storage.setItemAsync(MEK_KEY, base64);
    },
    async clear(): Promise<void> {
      if (!storage) return;
      await storage.deleteItemAsync(MEK_KEY);
    },
  };
}
