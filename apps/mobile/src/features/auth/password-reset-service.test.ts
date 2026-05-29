import { describe, expect, it } from "vitest";

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

    it("produces different wrapped MEKs for different passwords", async () => {
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
