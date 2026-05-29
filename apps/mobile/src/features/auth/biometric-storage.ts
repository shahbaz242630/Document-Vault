type SecureStorage = {
  deleteItemAsync: (key: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

const BIOMETRIC_ENABLED_KEY = "biometric_unlock_enabled";
const MEK_KEY = "biometric_mek_cache";

export function createBiometricStorage(storage: SecureStorage | null) {
  return {
    async isEnabled(): Promise<boolean> {
      if (!storage) {
        return false;
      }

      const value = await storage.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return value === "true";
    },

    async setEnabled(enabled: boolean): Promise<void> {
      if (!storage) {
        return;
      }

      if (enabled) {
        await storage.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
      } else {
        await storage.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      }
    },

    async getKey(): Promise<string | null> {
      if (!storage) {
        return null;
      }

      return storage.getItemAsync(MEK_KEY);
    },

    async setKey(key: string): Promise<void> {
      if (!storage) {
        return;
      }

      await storage.setItemAsync(MEK_KEY, key);
    },

    async clearKey(): Promise<void> {
      if (!storage) {
        return;
      }

      await storage.deleteItemAsync(MEK_KEY);
    },
  };
}
