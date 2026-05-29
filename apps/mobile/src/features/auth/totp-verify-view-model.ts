export type TotpVerifyViewModel = {
  body: string;
  codeInputLabel: string;
  primaryActionLabel: string;
  statusLabel: string;
  title: string;
};

export function createTotpVerifyViewModel(): TotpVerifyViewModel {
  return {
    body: "Enter the 6-digit code from your authenticator app to confirm everything is working. Once Supabase is ready, this will complete two-factor enrollment.",
    codeInputLabel: "6-digit code",
    primaryActionLabel: "Confirm and continue",
    statusLabel: "Required security step",
    title: "Verify authenticator code",
  };
}
