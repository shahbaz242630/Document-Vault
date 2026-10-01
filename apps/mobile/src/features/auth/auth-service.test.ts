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

  it("signs in with the password, then asks a verified factor's owner for their TOTP code", async () => {
    const calls: unknown[] = [];
    const service = createAuthService({
      auth: {
        mfa: mfa("aal1", [{ id: "factor-unverified", status: "unverified" }, { id: "factor-1", status: "verified" }]),
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
      factorId: "factor-1",
      message: "Enter the code from your authenticator app.",
      nextStep: "totp-verification",
      status: "ok",
    });
    expect(calls).toEqual([
      {
        email: "partner@example.com",
        password: "correct horse battery staple",
      },
    ]);
  });

  it("sends an account without a verified factor to enrolment, never straight to the vault", async () => {
    for (const factors of [[], [{ id: "factor-unverified", status: "unverified" }]]) {
      await expect(signedIn({ mfa: mfa("aal1", factors) })).resolves.toEqual({
        message: "Set up your second lock to continue.",
        nextStep: "totp-enrollment",
        status: "ok",
      });
    }
  });

  it("opens the vault only for a session that is already AAL2", async () => {
    await expect(signedIn({ mfa: mfa("aal2", [{ id: "factor-1", status: "verified" }]) })).resolves
      .toMatchObject({ nextStep: "vault-unlock", status: "ok" });
  });

  it("stops sign-in when the MFA state cannot be read", async () => {
    const failing = { data: null, error: { message: "Provider detail" } };
    for (const auth of [
      {},
      { mfa: { ...mfa("aal1", []), listFactors: () => Promise.resolve(failing) } },
      { mfa: { ...mfa("aal1", []), getAuthenticatorAssuranceLevel: () => Promise.resolve(failing) } },
    ]) {
      await expect(signedIn(auth)).resolves.toEqual({
        message: "Your second lock could not be checked. Please try again.",
        status: "error",
      });
    }
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

function mfa(currentLevel: string, totp: { id: string; status: string }[]) {
  return {
    getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel }, error: null }),
    listFactors: () => Promise.resolve({ data: { totp }, error: null }),
  };
}

function signedIn(auth: object) {
  return createAuthService({
    auth: {
      ...auth,
      signInWithPassword: () => Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
  }).signIn({ email: "partner@example.com", password: "correct horse battery staple" });
}
