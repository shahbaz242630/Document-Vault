import { describe, expect, it, vi } from "vitest";

import { createPasswordResetService } from "./password-reset-service";

describe("createPasswordResetService", () => {
  describe("requestReset", () => {
    it("returns unavailable when the Supabase client is not configured", async () => {
      const service = createPasswordResetService(null);
      const result = await service.requestReset("user@example.com");

      expect(result.status).toBe("unavailable");
    });

    it("returns ok when the reset email is sent successfully", async () => {
      const service = createPasswordResetService({
        auth: {
          async resetPasswordForEmail(email, options) {
            return { data: null, error: null };
          },
        },
      });

      const result = await service.requestReset("user@example.com");

      expect(result.status).toBe("ok");
    });

    it("returns error when the reset email fails", async () => {
      const service = createPasswordResetService({
        auth: {
          async resetPasswordForEmail() {
            return { data: null, error: { message: "Rate limited" } };
          },
        },
      });

      const result = await service.requestReset("user@example.com");

      expect(result.status).toBe("error");
    });
  });

  describe("resetWithRecoveryPhrase", () => {
    it("returns error when the phrase does not have 12 words", async () => {
      const service = createPasswordResetService(null);
      const result = await service.resetWithRecoveryPhrase({
        newPassword: "strongpassword123",
        phrase: ["one", "two", "three"],
      });

      expect(result.status).toBe("error");
    });

    it("returns error when the password is too short", async () => {
      const service = createPasswordResetService(null);
      const result = await service.resetWithRecoveryPhrase({
        newPassword: "short",
        phrase: Array(12).fill("abandon") as string[],
      });

      expect(result.status).toBe("error");
    });

    it("returns ok with wrapped MEK for valid phrase and password", async () => {
      const service = createPasswordResetService(null);
      const phrase = [
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "about",
      ];

      const result = await service.resetWithRecoveryPhrase({
        newPassword: "strongpassword123",
        phrase,
      });

      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.mekBase64.length).toBeGreaterThan(0);
        expect(result.saltBase64.length).toBeGreaterThan(0);
        expect(result.wrapped.ciphertextBase64.length).toBeGreaterThan(0);
        expect(result.wrapped.nonceBase64.length).toBeGreaterThan(0);
      }
    });

    it("persists recovered key material for the new password", async () => {
      const loadKeyMaterial = vi.fn().mockResolvedValue({
        kdfAlgorithm: "argon2id",
        kdfParams: {
          keyLength: 32,
          memlimit: 268435456,
          opslimit: 3,
        },
        kekSalt: new Uint8Array([1, 2, 3]),
        recoveryVersion: 4,
        wrappedMek: {
          ciphertext: new Uint8Array([4, 5, 6]),
          nonce: new Uint8Array([7, 8, 9]),
        },
      });
      const saveKeyMaterial = vi.fn().mockResolvedValue(undefined);
      const service = createPasswordResetService(null, {
        keyMaterialRepository: { loadKeyMaterial, saveKeyMaterial },
      });
      const phrase = [
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "about",
      ];

      const result = await service.resetWithRecoveryPhrase({
        newPassword: "strongpassword123",
        phrase,
      });

      expect(result.status).toBe("ok");
      expect(loadKeyMaterial).toHaveBeenCalledOnce();
      expect(saveKeyMaterial).toHaveBeenCalledOnce();
      expect(saveKeyMaterial).toHaveBeenCalledWith({
        kdfAlgorithm: "argon2id",
        kdfParams: {
          keyLength: 32,
          memlimit: 268435456,
          opslimit: 3,
        },
        kekSalt: expect.any(Uint8Array),
        recoveryVersion: 5,
        wrappedMek: {
          ciphertext: expect.any(Uint8Array),
          nonce: expect.any(Uint8Array),
        },
      });
    });

    it("updates Supabase Auth password before saving recovered key material", async () => {
      const updateUser = vi.fn().mockResolvedValue({ data: null, error: null });
      const saveKeyMaterial = vi.fn().mockResolvedValue(undefined);
      const service = createPasswordResetService(
        {
          auth: {
            updateUser,
          },
        },
        {
          keyMaterialRepository: { saveKeyMaterial },
        },
      );

      const result = await service.resetWithRecoveryPhrase({
        newPassword: "strongpassword123",
        phrase: validRecoveryPhrase(),
      });

      expect(result.status).toBe("ok");
      expect(updateUser).toHaveBeenCalledWith({ password: "strongpassword123" });
      expect(saveKeyMaterial).toHaveBeenCalledOnce();
      expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(
        saveKeyMaterial.mock.invocationCallOrder[0],
      );
    });

    it("does not save recovered key material when Supabase Auth password update fails", async () => {
      const updateUser = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Auth session missing" },
      });
      const saveKeyMaterial = vi.fn().mockResolvedValue(undefined);
      const service = createPasswordResetService(
        {
          auth: {
            updateUser,
          },
        },
        {
          keyMaterialRepository: { saveKeyMaterial },
        },
      );

      const result = await service.resetWithRecoveryPhrase({
        newPassword: "strongpassword123",
        phrase: validRecoveryPhrase(),
      });

      expect(result.status).toBe("error");
      expect(saveKeyMaterial).not.toHaveBeenCalled();
    });

    it("produces different wrapped MEKs for different passwords", async () => {
      const service = createPasswordResetService(null);
      const phrase = validRecoveryPhrase();

      const result1 = await service.resetWithRecoveryPhrase({
        newPassword: "strongpassword123",
        phrase,
      });
      const result2 = await service.resetWithRecoveryPhrase({
        newPassword: "differentpassword456",
        phrase,
      });

      expect(result1.status).toBe("ok");
      expect(result2.status).toBe("ok");

      if (result1.status === "ok" && result2.status === "ok") {
        expect(result1.wrapped.ciphertextBase64).not.toBe(
          result2.wrapped.ciphertextBase64,
        );
      }
    });
  });
});

function validRecoveryPhrase() {
  return [
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "abandon",
    "about",
  ];
}
