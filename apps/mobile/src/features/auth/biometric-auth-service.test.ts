import { describe, expect, it } from "vitest";

import { createBiometricAuthService } from "./biometric-auth-service";

describe("createBiometricAuthService", () => {
  describe("checkSupport", () => {
    it("returns unavailable when hardware is null", async () => {
      const service = createBiometricAuthService(null);
      await expect(service.checkSupport()).resolves.toEqual({
        available: false,
        enrolled: false,
      });
    });

    it("returns available and enrolled when hardware supports biometrics and user is enrolled", async () => {
      const service = createBiometricAuthService({
        async authenticateAsync() {
          return { success: true };
        },
        async hasHardwareAsync() {
          return true;
        },
        async isEnrolledAsync() {
          return true;
        },
      });

      await expect(service.checkSupport()).resolves.toEqual({
        available: true,
        enrolled: true,
      });
    });

    it("returns available but not enrolled when hardware exists but no biometrics are enrolled", async () => {
      const service = createBiometricAuthService({
        async authenticateAsync() {
          return { success: true };
        },
        async hasHardwareAsync() {
          return true;
        },
        async isEnrolledAsync() {
          return false;
        },
      });

      await expect(service.checkSupport()).resolves.toEqual({
        available: true,
        enrolled: false,
      });
    });

    it("returns unavailable when hardware support checks fail", async () => {
      const service = createBiometricAuthService({
        async authenticateAsync() {
          return { success: true };
        },
        async hasHardwareAsync() {
          throw new Error("Unknown");
        },
        async isEnrolledAsync() {
          return true;
        },
      });

      await expect(service.checkSupport()).resolves.toEqual({
        available: false,
        enrolled: false,
      });
    });
  });

  describe("authenticate", () => {
    it("returns error when hardware is null", async () => {
      const service = createBiometricAuthService(null);
      const result = await service.authenticate();

      expect(result.status).toBe("error");
    });

    it("returns success when biometric auth succeeds", async () => {
      const service = createBiometricAuthService({
        async authenticateAsync() {
          return { success: true };
        },
        async hasHardwareAsync() {
          return true;
        },
        async isEnrolledAsync() {
          return true;
        },
      });

      await expect(service.authenticate()).resolves.toEqual({ status: "success" });
    });

    it("returns cancelled when user cancels", async () => {
      const service = createBiometricAuthService({
        async authenticateAsync() {
          return { error: "user_cancel", success: false };
        },
        async hasHardwareAsync() {
          return true;
        },
        async isEnrolledAsync() {
          return true;
        },
      });

      await expect(service.authenticate()).resolves.toEqual({ status: "cancelled" });
    });

    it("returns error on generic failure", async () => {
      const service = createBiometricAuthService({
        async authenticateAsync() {
          return { error: "not_available", success: false };
        },
        async hasHardwareAsync() {
          return true;
        },
        async isEnrolledAsync() {
          return true;
        },
      });

      const result = await service.authenticate();

      expect(result.status).toBe("error");
    });
  });
});
