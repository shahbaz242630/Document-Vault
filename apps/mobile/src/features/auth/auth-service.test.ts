import { describe, expect, it } from "vitest";

import { createAuthService } from "./auth-service";

describe("createAuthService", () => {
  it("returns unavailable when the Supabase client is not configured", async () => {
    const service = createAuthService(null);

    await expect(
      service.signUp({
        email: "partner@example.com",
        password: "correct horse battery staple",
      }),
    ).resolves.toEqual({
      message: "Supabase is not configured yet.",
      status: "unavailable",
    });
  });

  it("signs up through Supabase Auth with normalized credentials", async () => {
    const calls: unknown[] = [];
    const service = createAuthService({
      auth: {
        signUp(input: unknown) {
          calls.push(input);
          return Promise.resolve({ data: { user: { id: "user-1" } }, error: null });
        },
      },
    });

    await expect(
      service.signUp({
        email: " Partner@Example.COM ",
        password: "correct horse battery staple",
      }),
    ).resolves.toEqual({
      message: "Check your email to continue setup.",
      nextStep: "email-verification",
      status: "ok",
    });
    expect(calls).toEqual([
      {
        email: "partner@example.com",
        password: "correct horse battery staple",
      },
    ]);
  });

  it("signs in through Supabase Auth with password credentials", async () => {
    const calls: unknown[] = [];
    const service = createAuthService({
      auth: {
        signInWithPassword(input: unknown) {
          calls.push(input);
          return Promise.resolve({ data: { user: { id: "user-1" } }, error: null });
        },
      },
    });

    await expect(
      service.signIn({
        email: "partner@example.com",
        password: "correct horse battery staple",
      }),
    ).resolves.toEqual({
      message: "Opening your vault.",
      nextStep: "vault-unlock",
      status: "ok",
    });
    expect(calls).toEqual([
      {
        email: "partner@example.com",
        password: "correct horse battery staple",
      },
    ]);
  });

  it("returns safe auth error messages without exposing provider details", async () => {
    const service = createAuthService({
      auth: {
        signInWithPassword() {
          return Promise.resolve({ data: null, error: { message: "Invalid login credentials" } });
        },
      },
    });

    await expect(
      service.signIn({
        email: "partner@example.com",
        password: "correct horse battery staple",
      }),
    ).resolves.toEqual({
      message: "Email or password could not be verified.",
      status: "error",
    });
  });
});
