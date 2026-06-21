import { describe, expect, it } from "vitest";

import { createBiometricStorage } from "./biometric-storage";

describe("createBiometricStorage", () => {
  it("returns false when storage is null", async () => {
    const storage = createBiometricStorage(null);
    await expect(storage.isEnabled()).resolves.toBe(false);
  });

  it("returns true when the enabled flag is set", async () => {
    const calls: unknown[] = [];
    const storage = createBiometricStorage({
      async deleteItemAsync(key) {
        calls.push({ type: "delete", key });
      },
      async getItemAsync(key) {
        calls.push({ type: "get", key });
        return "true";
      },
      async setItemAsync(key, value) {
        calls.push({ type: "set", key, value });
      },
    });

    await expect(storage.isEnabled()).resolves.toBe(true);
  });

  it("sets enabled to true", async () => {
    const calls: unknown[] = [];
    const storage = createBiometricStorage({
      async deleteItemAsync(key) {
        calls.push({ type: "delete", key });
      },
      async getItemAsync(key) {
        calls.push({ type: "get", key });
        return null;
      },
      async setItemAsync(key, value) {
        calls.push({ type: "set", key, value });
      },
    });

    await storage.setEnabled(true);

    expect(calls).toContainEqual({
      type: "set",
      key: "biometric_unlock_enabled",
      value: "true",
    });
  });

  it("deletes the key when setting enabled to false", async () => {
    const calls: unknown[] = [];
    const storage = createBiometricStorage({
      async deleteItemAsync(key) {
        calls.push({ type: "delete", key });
      },
      async getItemAsync(key) {
        calls.push({ type: "get", key });
        return null;
      },
      async setItemAsync(key, value) {
        calls.push({ type: "set", key, value });
      },
    });

    await storage.setEnabled(false);

    expect(calls).toContainEqual({
      type: "delete",
      key: "biometric_unlock_enabled",
    });
  });

  it("returns null for key when storage is null", async () => {
    const storage = createBiometricStorage(null);
    await expect(storage.getKey()).resolves.toBeNull();
  });

  it("stores and retrieves the cached key", async () => {
    const calls: unknown[] = [];
    const storage = createBiometricStorage({
      async deleteItemAsync(key) {
        calls.push({ type: "delete", key });
      },
      async getItemAsync(key, options) {
        calls.push({ type: "get", key, options });
        return "cached-mek";
      },
      async setItemAsync(key, value, options) {
        calls.push({ type: "set", key, value, options });
      },
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    });

    await expect(storage.getKey()).resolves.toBe("cached-mek");
    await storage.setKey("new-mek");

    expect(calls).toContainEqual({
      type: "get",
      key: "biometric_mek_cache",
      options: {
        authenticationPrompt: "Unlock Sanduqkin",
        keychainAccessible: 1,
        requireAuthentication: true,
      },
    });
    expect(calls).toContainEqual({
      type: "set",
      key: "biometric_mek_cache",
      value: "new-mek",
      options: {
        authenticationPrompt: "Unlock Sanduqkin",
        keychainAccessible: 1,
        requireAuthentication: true,
      },
    });
  });

  it("clears the cached key", async () => {
    const calls: unknown[] = [];
    const storage = createBiometricStorage({
      async deleteItemAsync(key, options) {
        calls.push({ type: "delete", key, options });
      },
      async getItemAsync() {
        return null;
      },
      async setItemAsync() {
        // no-op
      },
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    });

    await storage.clearKey();

    expect(calls).toContainEqual({
      type: "delete",
      key: "biometric_mek_cache",
      options: {
        authenticationPrompt: "Unlock Sanduqkin",
        keychainAccessible: 1,
        requireAuthentication: true,
      },
    });
  });
});
