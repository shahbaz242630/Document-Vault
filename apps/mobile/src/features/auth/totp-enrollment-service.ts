type SupabaseMfaEnrollResponse = Promise<{
  data: {
    id: string;
    totp?: {
      secret?: string;
      uri?: string;
    };
  } | null;
  error: { message: string } | null;
}>;

type SupabaseMfaClient = {
  auth: {
    mfa?: {
      enroll?: (input: { factorType: "totp" }) => SupabaseMfaEnrollResponse;
    };
  };
};

/*
 * The real Supabase TOTP enrolment. The factor stays unverified, and gives no second lock, until the owner proves
 * a code from it on the verify screen. The setup key and otpauth URI are shown once on the enrolment screen and are
 * never logged, stored or passed in a route.
 */
export type TotpEnrollmentServiceResult =
  | { message: string; status: "error" }
  | {
      factorId: string;
      message: string;
      otpauthUri: string;
      secret: string;
      status: "ok";
    }
  | { message: string; status: "unavailable" };

export function createTotpEnrollmentService(client: SupabaseMfaClient | null) {
  return {
    async enroll(): Promise<TotpEnrollmentServiceResult> {
      if (!client?.auth.mfa?.enroll) {
        return {
          message: "Supabase MFA is not configured yet.",
          status: "unavailable",
        };
      }

      const { data, error } = await client.auth.mfa.enroll({ factorType: "totp" });
      const secret = data?.totp?.secret;
      const otpauthUri = data?.totp?.uri;

      if (error || !data?.id || !secret || !otpauthUri?.startsWith("otpauth://totp/")) {
        return {
          message: "Two-factor setup could not be started.",
          status: "error",
        };
      }

      return {
        factorId: data.id,
        message: "Scan the QR code with your authenticator app.",
        otpauthUri,
        secret,
        status: "ok",
      };
    },
  };
}
