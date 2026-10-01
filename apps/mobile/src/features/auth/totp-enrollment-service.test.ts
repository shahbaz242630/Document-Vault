import { describe, expect, it } from "vitest";

import { createTotpEnrollmentService } from "./totp-enrollment-service";

const uri = "otpauth://totp/Sanduqkin:partner@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Sanduqkin";

function service(response: { data: unknown; error: { message: string } | null }) {
  const calls: unknown[] = [];
  return {
    calls,
    service: createTotpEnrollmentService({
      auth: {
        mfa: {
          enroll(input) {
            calls.push(input);
            return Promise.resolve(response as never);
          },
        },
      },
    }),
  };
}

describe("createTotpEnrollmentService", () => {
  it("returns unavailable until a Supabase client with MFA enrollment exists", async () => {
    await expect(createTotpEnrollmentService(null).enroll()).resolves.toEqual({
      message: "Supabase MFA is not configured yet.",
      status: "unavailable",
    });
  });

  it("starts a real Supabase TOTP enrolment and returns its factor ID, otpauth URI and setup key", async () => {
    const { calls, service: enrolment } = service({
      data: { id: "factor-1", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DPEHPK3PXP", uri } },
      error: null,
    });

    await expect(enrolment.enroll()).resolves.toEqual({
      factorId: "factor-1",
      message: "Scan the QR code with your authenticator app.",
      otpauthUri: uri,
      secret: "JBSWY3DPEHPK3PXP",
      status: "ok",
    });
    expect(calls).toEqual([{ factorType: "totp" }]);
  });

  it("refuses a response without the factor, the key or a TOTP otpauth URI", async () => {
    for (const data of [
      { id: "", totp: { secret: "JBSWY3DPEHPK3PXP", uri } },
      { id: "factor-1", totp: { uri } },
      { id: "factor-1", totp: { secret: "JBSWY3DPEHPK3PXP" } },
      { id: "factor-1", totp: { secret: "JBSWY3DPEHPK3PXP", uri: "https://example.com" } },
    ]) {
      await expect(service({ data, error: null }).service.enroll()).resolves.toEqual({
        message: "Two-factor setup could not be started.",
        status: "error",
      });
    }
  });

  it("returns a safe error when Supabase MFA enrollment fails", async () => {
    await expect(service({ data: null, error: { message: "Provider detail" } }).service.enroll())
      .resolves.toEqual({ message: "Two-factor setup could not be started.", status: "error" });
  });
});
