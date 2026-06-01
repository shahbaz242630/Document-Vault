import {
  createAuthCredentials,
  type AuthCredentialsInput,
} from "./auth-credentials";

type SupabaseAuthResponse = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type SupabaseAuthClient = {
  auth: {
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
      nextStep: "email-verification" | "totp-verification" | "vault-unlock";
      status: "ok";
    }
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

      return {
        message: "Opening your vault.",
        nextStep: "vault-unlock",
        status: "ok",
      };
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
