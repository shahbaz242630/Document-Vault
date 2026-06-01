import { describe, expect, it, vi } from "vitest";

import { createBiometricPreferenceService } from "./biometric-preference-service";

describe("createBiometricPreferenceService", () => {
  it("enables biometric unlock by authenticating and caching the stored MEK", async () => {
    const biometricAuth = {
      authenticate: vi.fn().mockResolvedValue({ status: "success" }),
    };
    const biometricStorage = {
      clearKey: vi.fn(),
      setEnabled: vi.fn(),
      setKey: vi.fn(),
    };
    const mekStorage = {
      get: vi.fn().mockResolvedValue("stored-mek-base64"),
    };

    const service = createBiometricPreferenceService({
      biometricAuth,
      biometricStorage,
      mekStorage,
    });

    await expect(service.enable()).resolves.toEqual({ status: "enabled" });

    expect(biometricAuth.authenticate).toHaveBeenCalledTimes(1);
    expect(mekStorage.get).toHaveBeenCalledTimes(1);
    expect(biometricStorage.setKey).toHaveBeenCalledWith("stored-mek-base64");
    expect(biometricStorage.setEnabled).toHaveBeenCalledWith(true);
  });

  it("does not enable biometric unlock when no stored MEK exists", async () => {
    const biometricStorage = {
      clearKey: vi.fn(),
      setEnabled: vi.fn(),
      setKey: vi.fn(),
    };
    const service = createBiometricPreferenceService({
      biometricAuth: {
        authenticate: vi.fn().mockResolvedValue({ status: "success" }),
      },
      biometricStorage,
      mekStorage: {
        get: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(service.enable()).resolves.toEqual({
      message: "No vault key is available. Please sign in again.",
      status: "error",
    });

    expect(biometricStorage.setKey).not.toHaveBeenCalled();
    expect(biometricStorage.setEnabled).not.toHaveBeenCalled();
  });

  it("disables biometric unlock by clearing the cached key and flag", async () => {
    const biometricStorage = {
      clearKey: vi.fn(),
      setEnabled: vi.fn(),
      setKey: vi.fn(),
    };
    const service = createBiometricPreferenceService({
      biometricAuth: {
        authenticate: vi.fn(),
      },
      biometricStorage,
      mekStorage: {
        get: vi.fn(),
      },
    });

    await service.disable();

    expect(biometricStorage.clearKey).toHaveBeenCalledTimes(1);
    expect(biometricStorage.setEnabled).toHaveBeenCalledWith(false);
  });
});
