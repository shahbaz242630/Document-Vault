import { describe, expect, it, vi } from "vitest";

import {
  createAppLockService,
  DEFAULT_LOCK_TIMEOUT_MS,
  shouldLockAfterBackground,
} from "./app-lock-service";

describe("shouldLockAfterBackground", () => {
  it("returns false when the elapsed time is under the timeout", () => {
    const now = 1_000_000;
    const backgroundedAt = now - DEFAULT_LOCK_TIMEOUT_MS + 1000;

    expect(shouldLockAfterBackground(backgroundedAt, now)).toBe(false);
  });

  it("returns true when the elapsed time meets the timeout", () => {
    const now = 1_000_000;
    const backgroundedAt = now - DEFAULT_LOCK_TIMEOUT_MS;

    expect(shouldLockAfterBackground(backgroundedAt, now)).toBe(true);
  });

  it("returns true when the elapsed time exceeds the timeout", () => {
    const now = 1_000_000;
    const backgroundedAt = now - DEFAULT_LOCK_TIMEOUT_MS - 1000;

    expect(shouldLockAfterBackground(backgroundedAt, now)).toBe(true);
  });

  it("respects a custom timeout", () => {
    const now = 1_000_000;
    const backgroundedAt = now - 30_000;

    expect(shouldLockAfterBackground(backgroundedAt, now, 60_000)).toBe(false);
    expect(shouldLockAfterBackground(backgroundedAt, now, 30_000)).toBe(true);
  });

  it("returns true when the system clock moves backward", () => {
    const now = 1_000_000;
    const backgroundedAt = now + 60_000;

    expect(shouldLockAfterBackground(backgroundedAt, now)).toBe(true);
  });
});

describe("createAppLockService", () => {
  it("returns failure without reading the key when biometric is not enabled", async () => {
    const getKey = vi.fn().mockResolvedValue(null);
    const service = createAppLockService({
      biometricStorage: {
        getKey,
        isEnabled: async () => false,
      },
    });

    await expect(service.unlock()).resolves.toEqual({
      success: false,
      reason: "Biometric unlock is not enabled. Please sign in again.",
    });
    expect(getKey).not.toHaveBeenCalled();
  });

  it("returns failure when biometric settings cannot be read", async () => {
    const service = createAppLockService({
      biometricStorage: {
        getKey: async () => "key",
        isEnabled: async () => {
          throw new Error("Storage unavailable");
        },
      },
    });

    await expect(service.unlock()).resolves.toEqual({
      success: false,
      reason: "Biometric unlock settings could not be read. Please sign in again.",
    });
  });

  it("maps a cancelled authenticated key read", async () => {
    const service = createAppLockService({
      biometricStorage: {
        getKey: async () => {
          throw new Error("User canceled the operation");
        },
        isEnabled: async () => true,
      },
    });

    const result = await service.unlock();

    expect(result.success).toBe(false);
    expect("reason" in result ? result.reason : "").toBe("Unlock was cancelled.");
  });

  it("returns failure when no authenticated cached key exists", async () => {
    const service = createAppLockService({
      biometricStorage: {
        getKey: async () => null,
        isEnabled: async () => true,
      },
    });

    const result = await service.unlock();

    expect(result.success).toBe(false);
    expect("reason" in result ? result.reason : "").toContain("No cached key");
  });

  it("returns key on successful biometric auth with cached key", async () => {
    const service = createAppLockService({
      biometricStorage: {
        getKey: async () => "cached-mek",
        isEnabled: async () => true,
      },
    });

    const result = await service.unlock();

    expect(result.success).toBe(true);
    expect("key" in result ? result.key : "").toBe("cached-mek");
  });

  it("maps unavailable native biometric storage errors", async () => {
    const service = createAppLockService({
      biometricStorage: {
        getKey: async () => {
          throw new Error("Biometric authentication not available");
        },
        isEnabled: async () => true,
      },
    });

    const result = await service.unlock();

    expect(result.success).toBe(false);
    expect("reason" in result ? result.reason : "").toContain("not available");
  });

  it("maps unexpected authenticated storage failures", async () => {
    const service = createAppLockService({
      biometricStorage: {
        getKey: async () => {
          throw new Error("Native keystore failure");
        },
        isEnabled: async () => true,
      },
    });

    await expect(service.unlock()).resolves.toEqual({
      success: false,
      reason: "Authentication failed. Try again or use your password.",
    });
  });
});
