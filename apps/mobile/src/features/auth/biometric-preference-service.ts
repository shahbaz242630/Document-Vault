type BiometricAuth = {
  authenticate: () => Promise<{ message?: string; status: string }>;
};

type BiometricStorage = {
  clearKey: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  setKey: (key: string) => Promise<void>;
};

type MekStorage = {
  get: () => Promise<string | null>;
};

export type BiometricPreferenceResult =
  | { status: "enabled" }
  | { message: string; status: "cancelled" | "error" };

export function createBiometricPreferenceService(deps: {
  biometricAuth: BiometricAuth;
  biometricStorage: BiometricStorage;
  mekStorage: MekStorage;
}) {
  return {
    async enable(): Promise<BiometricPreferenceResult> {
      const authResult = await deps.biometricAuth.authenticate();

      if (authResult.status === "cancelled") {
        return { message: "Unlock was cancelled.", status: "cancelled" };
      }

      if (authResult.status !== "success") {
        return {
          message: authResult.message ?? "Biometric authentication failed.",
          status: "error",
        };
      }

      const key = await deps.mekStorage.get();

      if (!key) {
        return {
          message: "No vault key is available. Please sign in again.",
          status: "error",
        };
      }

      await deps.biometricStorage.setKey(key);
      await deps.biometricStorage.setEnabled(true);

      return { status: "enabled" };
    },

    async disable(): Promise<void> {
      await deps.biometricStorage.clearKey();
      await deps.biometricStorage.setEnabled(false);
    },
  };
}
