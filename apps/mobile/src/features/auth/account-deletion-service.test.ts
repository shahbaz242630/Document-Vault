import { describe, expect, it } from "vitest";

import { createAuditLog } from "./audit-log";
import { createAccountDeletionService } from "./account-deletion-service";

describe("createAccountDeletionService", () => {
  it("logs account_deletion_requested", () => {
    const auditLog = createAuditLog();
    const service = createAccountDeletionService({
      auditLog,
      biometricStorage: {
        clearKey: async () => {},
        setEnabled: async () => {},
      },
      mekStorage: { clear: async () => {} },
      progressStorage: {
        clear: async () => {},
      },
    });

    service.logRequest();

    expect(auditLog.events).toHaveLength(1);
    expect(auditLog.events[0].eventType).toBe("account_deletion_requested");
  });

  it("records a server-side deletion request before logging the local audit event", async () => {
    const auditLog = createAuditLog();
    const calls: string[] = [];
    const service = createAccountDeletionService({
      auditLog: {
        anonymize: auditLog.anonymize,
        log(input) {
          calls.push(`audit:${input.eventType}`);
          auditLog.log(input);
        },
      },
      biometricStorage: {
        clearKey: async () => {},
        setEnabled: async () => {},
      },
      deletionRequestRepository: {
        async requestDeletion() {
          calls.push("server-request");
        },
      },
      mekStorage: { clear: async () => {} },
      progressStorage: {
        clear: async () => {},
      },
    });

    await service.requestDeletion();

    expect(calls).toEqual(["server-request", "audit:account_deletion_requested"]);
  });

  it("clears all stored data and anonymizes the audit log", async () => {
    const auditLog = createAuditLog();
    auditLog.log({
      deviceInfo: "test",
      eventType: "sign_in_success",
      userEmail: "partner@example.com",
    });

    const calls: unknown[] = [];
    const service = createAccountDeletionService({
      auditLog,
      biometricStorage: {
        async clearKey() {
          calls.push("clearKey");
        },
        async setEnabled(enabled) {
          calls.push({ type: "setEnabled", enabled });
        },
      },
      mekStorage: {
        async clear() {
          calls.push("clearMek");
        },
      },
      progressStorage: {
        async clear() {
          calls.push("clearProgress");
        },
      },
    });

    await service.clearStoredData();

    expect(calls).toContainEqual("clearKey");
    expect(calls).toContainEqual({ type: "setEnabled", enabled: false });
    expect(calls).toContainEqual("clearMek");
    expect(calls).toContainEqual("clearProgress");
    expect(auditLog.events[0].userEmail).toBeUndefined();
  });

  it("logs account_deletion_completed", () => {
    const auditLog = createAuditLog();
    const service = createAccountDeletionService({
      auditLog,
      biometricStorage: {
        clearKey: async () => {},
        setEnabled: async () => {},
      },
      mekStorage: { clear: async () => {} },
      progressStorage: {
        clear: async () => {},
      },
    });

    service.logCompletion();

    expect(auditLog.events).toHaveLength(1);
    expect(auditLog.events[0].eventType).toBe("account_deletion_completed");
  });
});
