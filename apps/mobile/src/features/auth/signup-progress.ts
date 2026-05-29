import { useEffect } from "react";

export type SignupStep =
  | "verify-email"
  | "profile-basics"
  | "setup-totp"
  | "backup-codes"
  | "verify-totp"
  | "recovery-phrase"
  | "confirm-recovery-phrase"
  | "setup-biometric";

export type SignupProgress = {
  email: string;
  step: SignupStep;
};

export type SecureStorage = {
  deleteItemAsync: (key: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

const SIGNUP_PROGRESS_KEY = "signup_progress";

export function createSignupProgressStorage(storage: SecureStorage | null) {
  return {
    async load(): Promise<SignupProgress | null> {
      if (!storage) {
        return null;
      }

      const raw = await storage.getItemAsync(SIGNUP_PROGRESS_KEY);

      if (!raw) {
        return null;
      }

      try {
        return JSON.parse(raw) as SignupProgress;
      } catch {
        return null;
      }
    },

    async save(progress: SignupProgress): Promise<void> {
      if (!storage) {
        return;
      }

      await storage.setItemAsync(SIGNUP_PROGRESS_KEY, JSON.stringify(progress));
    },

    async clear(): Promise<void> {
      if (!storage) {
        return;
      }

      await storage.deleteItemAsync(SIGNUP_PROGRESS_KEY);
    },
  };
}

export function getResumeRoute(progress: SignupProgress): string {
  switch (progress.step) {
    case "verify-email":
      return `/auth/verify-email?email=${encodeURIComponent(progress.email)}`;
    case "profile-basics":
      return `/auth/profile-basics?email=${encodeURIComponent(progress.email)}`;
    case "setup-totp":
      return "/auth/setup-totp";
    case "backup-codes":
      return "/auth/backup-codes?factorId=placeholder-factor-id";
    case "verify-totp":
      return "/auth/verify-totp?factorId=placeholder-factor-id";
    case "recovery-phrase":
      return "/auth/recovery-phrase";
    case "confirm-recovery-phrase":
      return "/auth/confirm-recovery-phrase";
    case "setup-biometric":
      return "/auth/setup-biometric";
  }
}

export function useSignupProgressStep(
  step: SignupStep,
  storage: SecureStorage,
): void {
  useEffect(() => {
    async function save() {
      const progressStorage = createSignupProgressStorage(storage);
      const existing = await progressStorage.load();

      if (existing) {
        await progressStorage.save({ ...existing, step });
      }
    }

    void save();
  }, [step, storage]);
}
