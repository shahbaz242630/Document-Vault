/** "enrollment" is an existing account proving the factor it has just added during sign-in. */
export type TotpVerifyVariant = "enrollment" | "onboarding" | "returning";

export type TotpVerifyViewModel = {
  body: string;
  codeInputLabel: string;
  primaryActionLabel: string;
  statusLabel: string | null;
  title: string;
};

export function createTotpVerifyViewModel(
  variant: TotpVerifyVariant = "onboarding",
): TotpVerifyViewModel {
  if (variant === "returning") {
    return {
      body: "Enter the 6-digit code from your authenticator app.",
      codeInputLabel: "6-digit code",
      primaryActionLabel: "Unlock vault",
      statusLabel: null,
      title: "Second lock",
    };
  }

  if (variant === "enrollment") {
    return {
      body: "Enter the 6-digit code your authenticator app shows right now. This turns on your second lock.",
      codeInputLabel: "6-digit code",
      primaryActionLabel: "Verify and open vault",
      statusLabel: null,
      title: "Let's test it",
    };
  }

  return {
    body: "Enter the 6-digit code your authenticator app shows right now.",
    codeInputLabel: "6-digit code",
    primaryActionLabel: "Verify",
    statusLabel: "Security · Step 3 of 3",
    title: "Let's test it",
  };
}
