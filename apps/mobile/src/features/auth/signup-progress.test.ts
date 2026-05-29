import { describe, expect, it } from "vitest";

import {
  createSignupProgressStorage,
  getResumeRoute,
} from "./signup-progress";

describe("createSignupProgressStorage", () => {
  it("returns null when storage is null", async () => {
    const storage = createSignupProgressStorage(null);

    await expect(storage.load()).resolves.toBeNull();
  });

  it("round-trips progress through storage", async () => {
    const calls: unknown[] = [];
    const storage = createSignupProgressStorage({
      async deleteItemAsync(key) {
        calls.push({ type: "delete", key });
      },
      async getItemAsync(key) {
        calls.push({ type: "get", key });
        return JSON.stringify({ email: "partner@example.com", step: "profile-basics" });
      },
      async setItemAsync(key, value) {
        calls.push({ type: "set", key, value });
      },
    });

    const loaded = await storage.load();

    expect(loaded).toEqual({ email: "partner@example.com", step: "profile-basics" });
  });

  it("saves progress as JSON", async () => {
    const calls: unknown[] = [];
    const storage = createSignupProgressStorage({
      async deleteItemAsync(key) {
        calls.push({ type: "delete", key });
      },
      async getItemAsync() {
        return null;
      },
      async setItemAsync(key, value) {
        calls.push({ type: "set", key, value });
      },
    });

    await storage.save({ email: "partner@example.com", step: "setup-totp" });

    expect(calls).toContainEqual({
      type: "set",
      key: "signup_progress",
      value: JSON.stringify({ email: "partner@example.com", step: "setup-totp" }),
    });
  });

  it("clears progress by deleting the key", async () => {
    const calls: unknown[] = [];
    const storage = createSignupProgressStorage({
      async deleteItemAsync(key) {
        calls.push({ type: "delete", key });
      },
      async getItemAsync() {
        return null;
      },
      async setItemAsync() {
        // no-op
      },
    });

    await storage.clear();

    expect(calls).toContainEqual({
      type: "delete",
      key: "signup_progress",
    });
  });

  it("returns null for corrupt stored data", async () => {
    const storage = createSignupProgressStorage({
      async deleteItemAsync() {
        // no-op
      },
      async getItemAsync() {
        return "not-json";
      },
      async setItemAsync() {
        // no-op
      },
    });

    await expect(storage.load()).resolves.toBeNull();
  });
});

describe("getResumeRoute", () => {
  it("returns verify-email route with encoded email", () => {
    const route = getResumeRoute({ email: "partner@example.com", step: "verify-email" });

    expect(route).toBe("/auth/verify-email?email=partner%40example.com");
  });

  it("returns profile-basics route with encoded email", () => {
    const route = getResumeRoute({ email: "a+b@c.com", step: "profile-basics" });

    expect(route).toBe("/auth/profile-basics?email=a%2Bb%40c.com");
  });

  it("returns setup-totp route without params", () => {
    const route = getResumeRoute({ email: "partner@example.com", step: "setup-totp" });

    expect(route).toBe("/auth/setup-totp");
  });

  it("returns backup-codes route with placeholder factorId", () => {
    const route = getResumeRoute({ email: "partner@example.com", step: "backup-codes" });

    expect(route).toBe("/auth/backup-codes?factorId=placeholder-factor-id");
  });

  it("returns verify-totp route with placeholder factorId", () => {
    const route = getResumeRoute({ email: "partner@example.com", step: "verify-totp" });

    expect(route).toBe("/auth/verify-totp?factorId=placeholder-factor-id");
  });

  it("returns recovery-phrase route without params", () => {
    const route = getResumeRoute({ email: "partner@example.com", step: "recovery-phrase" });

    expect(route).toBe("/auth/recovery-phrase");
  });

  it("returns confirm-recovery-phrase route without params", () => {
    const route = getResumeRoute({ email: "partner@example.com", step: "confirm-recovery-phrase" });

    expect(route).toBe("/auth/confirm-recovery-phrase");
  });

  it("returns setup-biometric route without params", () => {
    const route = getResumeRoute({ email: "partner@example.com", step: "setup-biometric" });

    expect(route).toBe("/auth/setup-biometric");
  });
});
