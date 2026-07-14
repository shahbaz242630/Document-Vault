import { describe, expect, it } from "vitest";

import { createEmailVerificationViewModel } from "./email-verification-view-model";

describe("createEmailVerificationViewModel", () => {
  it("returns safe placeholder copy when no email is available", () => {
    expect(createEmailVerificationViewModel()).toEqual({
      body:
        "It confirms this address is really yours. Open the link we sent, then continue below.",
      destinationLabel: "your email",
      title: "Check your email",
    });
  });

  it("normalizes the destination email for display", () => {
    expect(createEmailVerificationViewModel(" Partner@Example.COM ")).toEqual({
      body:
        "It confirms this address is really yours. Open the link we sent, then continue below.",
      destinationLabel: "partner@example.com",
      title: "Check your email",
    });
  });
});
