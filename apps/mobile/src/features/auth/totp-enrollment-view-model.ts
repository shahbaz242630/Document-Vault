export type TotpEnrollmentViewModel = {
  body: string;
  primaryActionLabel: string;
  statusLabel: string;
  title: string;
};

export function createTotpEnrollmentViewModel(): TotpEnrollmentViewModel {
  return {
    body:
      "Sanduqkin will use Supabase MFA with an authenticator app. Once the Supabase project is ready, this screen will show a QR code and verify your first TOTP code.",
    primaryActionLabel: "Continue to verification",
    statusLabel: "Required security step",
    title: "Set up two-factor authentication",
  };
}
