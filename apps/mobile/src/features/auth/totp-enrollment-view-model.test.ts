import { describe, expect, it } from "vitest";

import { createTotpEnrollmentViewModel } from "./totp-enrollment-view-model";

describe("createTotpEnrollmentViewModel", () => {
  it("returns second-lock enrollment copy", () => {
    expect(createTotpEnrollmentViewModel()).toEqual({
      body:
        "Scan this with an authenticator app (like Google Authenticator or 1Password). Even if someone learns your password, they can't get in without this.",
      primaryActionLabel: "I've added it",
      statusLabel: "Security · Step 1 of 3",
      title: "Add your second lock",
    });
  });
});
