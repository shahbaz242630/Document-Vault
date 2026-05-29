import { describe, expect, it } from "vitest";

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
  it("returns success with null key when biometric is not enabled", async () => {
    const service = createAppLockService({
      biometricAuth: {
        authenticate: async () => ({ status: "success" }),
      },
      biometricStorage: {
        getKey: async () => null,
        isEnabled: async () => false,
      },
    });

    const result = await service.unlock();

    expect(result.success).toBe(true);
    expect("key" in result ? result.key : null).toBeNull();
  });

  it("returns failure when biometric auth fails", async () => {
    const service = createAppLockService({
      biometricAuth: {
        authenticate: async () => ({ status: "error", message: "Failed" }),
      },
      biometricStorage: {
        getKey: async () => "key",
        isEnabled: async () => true,
      },
    });

    const result = await service.unlock();

    expect(result.success).toBe(false);
    expect("reason" in result ? result.reason : "").toBe("Failed");
  });

  it("returns failure when biometric is cancelled", async () => {
    const service = createAppLockService({
      biometricAuth: {
        authenticate: async () => ({ status: "cancelled" }),
      },
      biometricStorage: {
        getKey: async () => "key",
        isEnabled: async () => true,
      },
    });

    const result = await service.unlock();

    expect(result.success).toBe(false);
    expect("reason" in result ? result.reason : "").toBe("Unlock was cancelled.");
  });

  it("returns failure when no cached key exists", async () => {
    const service = createAppLockService({
      biometricAuth: {
        authenticate: async () => ({ status: "success" }),
      },
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
      biometricAuth: {
        authenticate: async () => ({ status: "success" }),
      },
      biometricStorage: {
        getKey: async () => "cached-mek",
        isEnabled: async () => true,
      },
    });

    const result = await service.unlock();

    expect(result.success).toBe(true);
    expect("key" in result ? result.key : "").toBe("cached-mek");
  });
});
