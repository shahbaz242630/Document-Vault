export type ReAuthViewModel = {
  bypassLabel: string;
  emailLabel: string;
  passwordLabel: string;
  primaryActionLabel: string;
  subtitle: string;
  title: string;
  totpLabel: string;
  totpPlaceholder: string;
  unavailableMessage: string;
  verifyingLabel: string;
};

export function createReAuthViewModel(): ReAuthViewModel {
  return {
    bypassLabel: "Skip re-authentication (prototype only)",
    emailLabel: "Email",
    passwordLabel: "Password",
    primaryActionLabel: "Verify",
    subtitle:
      "Re-authentication is required before deleting your account.",
    title: "Verify your identity",
    totpLabel: "Two-factor code",
    totpPlaceholder: "000000",
    unavailableMessage:
      "Server re-authentication is not available. Supabase must be configured.",
    verifyingLabel: "Verifying...",
  };
}
