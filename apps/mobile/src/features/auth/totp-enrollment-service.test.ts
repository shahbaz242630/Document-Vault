import { describe, expect, it } from "vitest";

import { createTotpEnrollmentService } from "./totp-enrollment-service";

describe("createTotpEnrollmentService", () => {
  it("returns unavailable until a Supabase client with MFA enrollment exists", async () => {
    const service = createTotpEnrollmentService(null);

    await expect(service.enroll()).resolves.toEqual({
      message: "Supabase MFA is not configured yet.",
      status: "unavailable",
    });
  });

  it("starts Supabase TOTP enrollment", async () => {
    const calls: unknown[] = [];
    const service = createTotpEnrollmentService({
      auth: {
        mfa: {
          enroll(input: unknown) {
            calls.push(input);
            return Promise.resolve({
              data: {
                id: "factor-1",
                totp: {
                  qr_code: "otpauth://totp/Sanduqkin:partner@example.com",
                },
              },
              error: null,
            });
          },
        },
      },
    });

    await expect(service.enroll()).resolves.toEqual({
      factorId: "factor-1",
      message: "Scan the QR code with your authenticator app.",
      qrCodeUri: "otpauth://totp/Sanduqkin:partner@example.com",
      status: "ok",
    });
    expect(calls).toEqual([{ factorType: "totp" }]);
  });

  it("returns a safe error when Supabase MFA enrollment fails", async () => {
    const service = createTotpEnrollmentService({
      auth: {
        mfa: {
          enroll() {
            return Promise.resolve({
              data: null,
              error: { message: "Provider detail" },
            });
          },
        },
      },
    });

    await expect(service.enroll()).resolves.toEqual({
      message: "Two-factor setup could not be started.",
      status: "error",
    });
  });
});
