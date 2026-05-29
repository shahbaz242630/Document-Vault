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

type BiometricAuth = {
  authenticate: () => Promise<{ message?: string; status: string }>;
};

type BiometricStorage = {
  getKey: () => Promise<string | null>;
  isEnabled: () => Promise<boolean>;
};

export type AppLockService = {
  unlock: () => Promise<
    | { key: null; success: true }
    | { key: string; success: true }
    | { reason: string; success: false }
  >;
};

export function createAppLockService(deps: {
  biometricAuth: BiometricAuth;
  biometricStorage: BiometricStorage;
}): AppLockService {
  return {
    async unlock() {
      const enabled = await deps.biometricStorage.isEnabled();

      if (!enabled) {
        return { success: true, key: null };
      }

      const authResult = await deps.biometricAuth.authenticate();

      if (authResult.status !== "success") {
        return {
          success: false,
          reason:
            authResult.status === "error"
              ? (authResult.message ?? "Authentication failed.")
              : "Unlock was cancelled.",
        };
      }

      const key = await deps.biometricStorage.getKey();

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
