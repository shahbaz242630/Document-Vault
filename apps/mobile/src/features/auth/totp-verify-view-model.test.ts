import { describe, expect, it } from "vitest";

import { createTotpVerifyViewModel } from "./totp-verify-view-model";

describe("createTotpVerifyViewModel", () => {
  it("returns TOTP verification placeholder copy", () => {
    expect(createTotpVerifyViewModel()).toEqual({
      body: "Enter the 6-digit code from your authenticator app to confirm everything is working. Once Supabase is ready, this will complete two-factor enrollment.",
      codeInputLabel: "6-digit code",
      primaryActionLabel: "Confirm and continue",
      statusLabel: "Required security step",
      title: "Verify authenticator code",
    });
  });
});
