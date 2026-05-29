import { describe, expect, it } from "vitest";

import { createEmailVerificationViewModel } from "./email-verification-view-model";

describe("createEmailVerificationViewModel", () => {
  it("returns safe placeholder copy when no email is available", () => {
    expect(createEmailVerificationViewModel()).toEqual({
      body:
        "Once Supabase email settings are ready, this step will confirm your email before two-factor setup.",
      destinationLabel: "your email",
      title: "Check your email",
    });
  });

  it("normalizes the destination email for display", () => {
    expect(createEmailVerificationViewModel(" Partner@Example.COM ")).toEqual({
      body:
        "Once Supabase email settings are ready, this step will confirm your email before two-factor setup.",
      destinationLabel: "partner@example.com",
      title: "Check your email",
    });
  });
});
