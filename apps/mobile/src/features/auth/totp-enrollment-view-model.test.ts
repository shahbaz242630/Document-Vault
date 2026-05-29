import { describe, expect, it } from "vitest";

import { createTotpEnrollmentViewModel } from "./totp-enrollment-view-model";

describe("createTotpEnrollmentViewModel", () => {
  it("returns Supabase MFA enrollment placeholder copy", () => {
    expect(createTotpEnrollmentViewModel()).toEqual({
      body:
        "Sanduqkin will use Supabase MFA with an authenticator app. Once the Supabase project is ready, this screen will show a QR code and verify your first TOTP code.",
      primaryActionLabel: "Continue to verification",
      statusLabel: "Required security step",
      title: "Set up two-factor authentication",
    });
  });
});
