type SecureStorage = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY?: number;
  deleteItemAsync: (key: string, options?: SecureStorageOptions) => Promise<void>;
  getItemAsync: (key: string, options?: SecureStorageOptions) => Promise<string | null>;
  setItemAsync: (key: string, value: string, options?: SecureStorageOptions) => Promise<void>;
};

type SecureStorageOptions = {
  authenticationPrompt?: string;
  keychainAccessible?: number;
  requireAuthentication?: boolean;
};

const BIOMETRIC_ENABLED_KEY = "biometric_unlock_enabled";
const MEK_KEY = "biometric_mek_cache";

export function createBiometricStorage(storage: SecureStorage | null) {
  const authenticatedMekOptions = createAuthenticatedMekOptions(storage);

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

      return storage.getItemAsync(MEK_KEY, authenticatedMekOptions);
    },

    async setKey(key: string): Promise<void> {
      if (!storage) {
        return;
      }

      await storage.setItemAsync(MEK_KEY, key, authenticatedMekOptions);
    },

    async clearKey(): Promise<void> {
      if (!storage) {
        return;
      }

      await storage.deleteItemAsync(MEK_KEY, authenticatedMekOptions);
    },
  };
}

function createAuthenticatedMekOptions(
  storage: SecureStorage | null,
): SecureStorageOptions {
  return {
    authenticationPrompt: "Unlock Sanduqkin",
    keychainAccessible: storage?.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: true,
  };
}
