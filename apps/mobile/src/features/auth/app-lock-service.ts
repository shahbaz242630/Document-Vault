export const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function shouldLockAfterBackground(
  backgroundedAt: number,
  now: number,
  timeoutMs: number = DEFAULT_LOCK_TIMEOUT_MS,
): boolean {
  // If the system clock moved backward, treat as tampering and lock immediately.
  if (now < backgroundedAt) return true;
  return now - backgroundedAt >= timeoutMs;
}

type BiometricStorage = {
  getKey: () => Promise<string | null>;
  isEnabled: () => Promise<boolean>;
};

export type AppLockService = {
  unlock: () => Promise<
    | { key: string; success: true }
    | { reason: string; success: false }
  >;
};

export function createAppLockService(deps: {
  biometricStorage: BiometricStorage;
}): AppLockService {
  return {
    async unlock() {
      let enabled: boolean;
      try {
        enabled = await deps.biometricStorage.isEnabled();
      } catch {
        return {
          success: false,
          reason: "Biometric unlock settings could not be read. Please sign in again.",
        };
      }

      if (!enabled) {
        return {
          success: false,
          reason: "Biometric unlock is not enabled. Please sign in again.",
        };
      }

      let key: string | null;
      try {
        // SecureStore's authenticated read owns the single native prompt.
        // Calling LocalAuthentication first can cause an early or duplicate prompt.
        key = await deps.biometricStorage.getKey();
      } catch (error) {
        return {
          success: false,
          reason: mapAuthenticatedStorageError(error),
        };
      }

      if (!key) {
        return {
          success: false,
          reason: "No cached key found. Please sign in again.",
        };
      }

      return { success: true, key };
    },
  };
}

function mapAuthenticatedStorageError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("cancel")) {
    return "Unlock was cancelled.";
  }

  if (
    message.includes("not available") ||
    message.includes("not enrolled") ||
    message.includes("no biometrics")
  ) {
    return "Biometric authentication is not available. Check this device's biometric settings or use your password.";
  }

  return "Authentication failed. Try again or use your password.";
}
