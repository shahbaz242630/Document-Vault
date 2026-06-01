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

export type AccountDeletionService = {
  clearStoredData: () => Promise<void>;
  logCompletion: () => void;
  logRequest: () => void;
};

export function createAccountDeletionService(deps: {
  auditLog: Pick<AuditLog, "anonymize" | "log">;
  biometricStorage: BiometricStorage;
  mekStorage: MekStorage;
  progressStorage: ProgressStorage;
}): AccountDeletionService {
  return {
    logRequest(): void {
      deps.auditLog.log({
        deviceInfo: "React Native",
        eventType: "account_deletion_requested",
      });
    },

    async clearStoredData(): Promise<void> {
      await deps.biometricStorage.clearKey();
      await deps.biometricStorage.setEnabled(false);
      await deps.mekStorage.clear();
      await deps.progressStorage.clear();
      deps.auditLog.anonymize();
    },

    logCompletion(): void {
      deps.auditLog.log({
        deviceInfo: "React Native",
        eventType: "account_deletion_completed",
      });
    },
  };
}
