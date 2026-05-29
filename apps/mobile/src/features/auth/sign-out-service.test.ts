import { describe, expect, it, vi } from "vitest";

import { createSignOutService } from "./sign-out-service";

describe("createSignOutService", () => {
  it("calls vaultSignOut, clears biometric key, disables biometric, clears signup progress, and anonymizes audit log", async () => {
    const vaultSignOut = vi.fn();
    const biometricStorage = {
      clearKey: vi.fn().mockResolvedValue(undefined),
      setEnabled: vi.fn().mockResolvedValue(undefined),
    };
    const progressStorage = {
      clear: vi.fn().mockResolvedValue(undefined),
    };
    const mekStorage = { clear: vi.fn().mockResolvedValue(undefined) };
    const auditLog = { anonymize: vi.fn(), events: [], log: vi.fn() };

    const service = createSignOutService({
      auditLog,
      biometricStorage,
      mekStorage,
      progressStorage,
      vaultSignOut,
    });

    await service.signOut();

    expect(vaultSignOut).toHaveBeenCalledTimes(1);
    expect(biometricStorage.clearKey).toHaveBeenCalledTimes(1);
    expect(biometricStorage.setEnabled).toHaveBeenCalledWith(false);
    expect(mekStorage.clear).toHaveBeenCalledTimes(1);
    expect(progressStorage.clear).toHaveBeenCalledTimes(1);
    expect(auditLog.anonymize).toHaveBeenCalledTimes(1);
  });

  it("still completes even if biometric storage throws", async () => {
    const vaultSignOut = vi.fn();
    const biometricStorage = {
      clearKey: vi.fn().mockRejectedValue(new Error("Storage error")),
      setEnabled: vi.fn().mockResolvedValue(undefined),
    };
    const progressStorage = {
      clear: vi.fn().mockResolvedValue(undefined),
    };
    const mekStorage = { clear: vi.fn().mockResolvedValue(undefined) };
    const auditLog = { anonymize: vi.fn(), events: [], log: vi.fn() };

    const service = createSignOutService({
      auditLog,
      biometricStorage,
      mekStorage,
      progressStorage,
      vaultSignOut,
    });

    await expect(service.signOut()).rejects.toThrow("Storage error");
  });
});
