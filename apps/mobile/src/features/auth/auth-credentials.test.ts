import { describe, expect, it } from "vitest";

import { createAuthCredentials } from "./auth-credentials";

describe("createAuthCredentials", () => {
  it("normalizes valid email and password credentials", () => {
    expect(
      createAuthCredentials({
        email: " Partner@Example.COM ",
        password: "correct horse battery staple",
      }),
    ).toEqual({
      email: "partner@example.com",
      password: "correct horse battery staple",
    });
  });

  it("rejects weak passwords before Supabase is called", () => {
    expect(() =>
      createAuthCredentials({
        email: "partner@example.com",
        password: "short",
      }),
    ).toThrow("Use at least 12 characters.");
  });

  it("rejects invalid emails before Supabase is called", () => {
    expect(() =>
      createAuthCredentials({
        email: "not-an-email",
        password: "correct horse battery staple",
      }),
    ).toThrow("Enter a valid email address.");
  });
});
