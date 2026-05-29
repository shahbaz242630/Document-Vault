type SupabaseMfaEnrollResponse = Promise<{
  data: {
    id: string;
    totp?: {
      qr_code?: string;
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

export type TotpEnrollmentServiceResult =
  | { message: string; status: "error" }
  | {
      factorId: string;
      message: string;
      qrCodeUri: string;
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

      if (error || !data?.id || !data.totp?.qr_code) {
        return {
          message: "Two-factor setup could not be started.",
          status: "error",
        };
      }

      return {
        factorId: data.id,
        message: "Scan the QR code with your authenticator app.",
        qrCodeUri: data.totp.qr_code,
        status: "ok",
      };
    },
  };
}
