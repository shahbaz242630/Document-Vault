import type { AuditLog } from "./audit-log";

type BiometricStorage = {
  clearKey: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
};

type MekStorage = {
  clear: () => Promise<void>;
};

type ProgressStorage = {
  clear: () => Promise<void>;
};

export type SignOutService = {
  signOut(): Promise<void>;
};

export function createSignOutService(deps: {
  auditLog: Pick<AuditLog, "anonymize">;
  biometricStorage: BiometricStorage;
  mekStorage: MekStorage;
  progressStorage: ProgressStorage;
  vaultSignOut: () => void;
}): SignOutService {
  return {
    async signOut(): Promise<void> {
      deps.vaultSignOut();
      await deps.biometricStorage.clearKey();
      await deps.biometricStorage.setEnabled(false);
      await deps.mekStorage.clear();
      await deps.progressStorage.clear();
      deps.auditLog.anonymize();
    },
  };
}
