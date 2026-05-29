type SupabaseMfaChallengeResponse = Promise<{
  data: { id: string } | null;
  error: { message: string } | null;
}>;

type SupabaseMfaVerifyResponse = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type SupabaseMfaChallengeAndVerifyClient = {
  auth: {
    mfa?: {
      challenge?: (input: { factorId: string }) => SupabaseMfaChallengeResponse;
      verify?: (input: {
        code: string;
        factorId: string;
        challengeId: string;
      }) => SupabaseMfaVerifyResponse;
    };
  };
};

export type TotpVerifyServiceResult =
  | { message: string; status: "error" }
  | { message: string; status: "ok" }
  | { message: string; status: "unavailable" };

export function createTotpVerifyService(
  client: SupabaseMfaChallengeAndVerifyClient | null,
) {
  return {
    async verify(
      factorId: string,
      code: string,
    ): Promise<TotpVerifyServiceResult> {
      if (!client?.auth.mfa?.challenge || !client.auth.mfa.verify) {
        return {
          message: "Supabase MFA is not configured yet.",
          status: "unavailable",
        };
      }

      const challengeResult = await client.auth.mfa.challenge({ factorId });

      if (challengeResult.error || !challengeResult.data?.id) {
        return {
          message: "The code could not be verified. Try again.",
          status: "error",
        };
      }

      const verifyResult = await client.auth.mfa.verify({
        challengeId: challengeResult.data.id,
        code,
        factorId,
      });

      if (verifyResult.error) {
        return {
          message: "The code could not be verified. Try again.",
          status: "error",
        };
      }

      return {
        message: "Two-factor authentication is now active.",
        status: "ok",
      };
    },
  };
}
