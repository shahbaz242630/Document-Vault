import {
  createAuthCredentials,
  type AuthCredentialsInput,
} from "./auth-credentials";

type SupabaseAuthResponse = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type SupabaseMfaStatusClient = {
  getAuthenticatorAssuranceLevel?: () => Promise<{
    data: { currentLevel: string | null } | null;
    error: { message: string } | null;
  }>;
  listFactors?: () => Promise<{
    data: { totp?: { id: string; status: string }[] } | null;
    error: { message: string } | null;
  }>;
};

type SupabaseAuthClient = {
  auth: {
    mfa?: SupabaseMfaStatusClient;
    signInWithPassword?: (credentials: {
      email: string;
      password: string;
    }) => SupabaseAuthResponse;
    signUp?: (credentials: { email: string; password: string }) => SupabaseAuthResponse;
  };
};

export type AuthServiceResult =
  | { message: string; status: "error" }
  | {
      message: string;
      nextStep: "email-verification" | "totp-enrollment" | "vault-unlock";
      status: "ok";
    }
  | { factorId: string; message: string; nextStep: "totp-verification"; status: "ok" }
  | { message: string; status: "unavailable" };

export function createAuthService(client: SupabaseAuthClient | null) {
  return {
    async signIn(values: AuthCredentialsInput): Promise<AuthServiceResult> {
      if (!client?.auth.signInWithPassword) {
        return supabaseUnavailableResult();
      }

      const credentials = createAuthCredentials(values);
      const { error } = await client.auth.signInWithPassword(credentials);

      if (error) {
        return authFailureResult();
      }

      return secondLockStep(client.auth.mfa);
    },
    async signUp(values: AuthCredentialsInput): Promise<AuthServiceResult> {
      if (!client?.auth.signUp) {
        return supabaseUnavailableResult();
      }

      const credentials = createAuthCredentials(values);
      const { error } = await client.auth.signUp(credentials);

      if (error) {
        return authFailureResult();
      }

      return {
        message: "Check your email to continue setup.",
        nextStep: "email-verification",
        status: "ok",
      };
    },
  };
}

/*
 * Two-factor is mandatory (BRD). A password alone never opens the vault: an account with a verified TOTP factor
 * must pass it to reach AAL2, and an account without one must enrol one first. If the MFA state cannot be read,
 * sign-in stops rather than guessing.
 */
async function secondLockStep(mfa: SupabaseMfaStatusClient | undefined): Promise<AuthServiceResult> {
  if (!mfa?.getAuthenticatorAssuranceLevel || !mfa.listFactors) {
    return secondLockUnavailableResult();
  }

  const [assurance, factors] = await Promise.all([
    mfa.getAuthenticatorAssuranceLevel(),
    mfa.listFactors(),
  ]);

  if (assurance.error || factors.error || !assurance.data || !factors.data) {
    return secondLockUnavailableResult();
  }

  if (assurance.data.currentLevel === "aal2") {
    return { message: "Opening your vault.", nextStep: "vault-unlock", status: "ok" };
  }

  const verified = factors.data.totp?.find((factor) => factor.status === "verified");

  if (verified) {
    return {
      factorId: verified.id,
      message: "Enter the code from your authenticator app.",
      nextStep: "totp-verification",
      status: "ok",
    };
  }

  return {
    message: "Set up your second lock to continue.",
    nextStep: "totp-enrollment",
    status: "ok",
  };
}

function secondLockUnavailableResult(): AuthServiceResult {
  return {
    message: "Your second lock could not be checked. Please try again.",
    status: "error",
  };
}

function authFailureResult(): AuthServiceResult {
  return {
    message: "Email or password could not be verified.",
    status: "error",
  };
}

function supabaseUnavailableResult(): AuthServiceResult {
  return {
    message: "Supabase is not configured yet.",
    status: "unavailable",
  };
}
