import { describe, expect, it } from "vitest";

import { createTotpVerifyService } from "./totp-verify-service";

describe("createTotpVerifyService", () => {
  it("returns unavailable until a Supabase client with MFA challenge and verify exists", async () => {
    const service = createTotpVerifyService(null);

    await expect(service.verify("factor-1", "123456")).resolves.toEqual({
      message: "Supabase MFA is not configured yet.",
      status: "unavailable",
    });
  });

  it("returns ok when challenge and verify both succeed", async () => {
    const service = createTotpVerifyService({
      auth: {
        mfa: {
          challenge(input: unknown) {
            return Promise.resolve({
              data: { id: "challenge-1" },
              error: null,
            });
          },
          verify(input: unknown) {
            return Promise.resolve({
              data: {},
              error: null,
            });
          },
        },
      },
    });

    await expect(service.verify("factor-1", "123456")).resolves.toEqual({
      message: "Two-factor authentication is now active.",
      status: "ok",
    });
  });

  it("returns error when challenge fails", async () => {
    const service = createTotpVerifyService({
      auth: {
        mfa: {
          challenge() {
            return Promise.resolve({
              data: null,
              error: { message: "Provider detail" },
            });
          },
          verify() {
            return Promise.resolve({
              data: {},
              error: null,
            });
          },
        },
      },
    });

    await expect(service.verify("factor-1", "123456")).resolves.toEqual({
      message: "The code could not be verified. Try again.",
      status: "error",
    });
  });

  it("returns error when verify fails", async () => {
    const service = createTotpVerifyService({
      auth: {
        mfa: {
          challenge() {
            return Promise.resolve({
              data: { id: "challenge-1" },
              error: null,
            });
          },
          verify() {
            return Promise.resolve({
              data: null,
              error: { message: "Provider detail" },
            });
          },
        },
      },
    });

    await expect(service.verify("factor-1", "123456")).resolves.toEqual({
      message: "The code could not be verified. Try again.",
      status: "error",
    });
  });
});
