import { describe, expect, it } from "vitest";

import { createTotpVerifyViewModel } from "./totp-verify-view-model";

describe("createTotpVerifyViewModel", () => {
  it("returns onboarding TOTP verification copy", () => {
    expect(createTotpVerifyViewModel()).toEqual({
      body: "Enter the 6-digit code your authenticator app shows right now.",
      codeInputLabel: "6-digit code",
      primaryActionLabel: "Verify",
      statusLabel: "Security · Step 3 of 3",
      title: "Let's test it",
    });
  });

  it("returns returning-user copy for the second lock", () => {
    expect(createTotpVerifyViewModel("returning")).toEqual({
      body: "Enter the 6-digit code from your authenticator app.",
      codeInputLabel: "6-digit code",
      primaryActionLabel: "Unlock vault",
      statusLabel: null,
      title: "Second lock",
    });
  });
});
