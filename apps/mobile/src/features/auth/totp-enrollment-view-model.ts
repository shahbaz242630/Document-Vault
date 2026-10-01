/** "onboarding" is the sign-up journey; "sign-in" is an existing account that has no verified second lock yet. */
export type TotpEnrollmentFlow = "onboarding" | "sign-in";

export type TotpEnrollmentViewModel = {
  body: string;
  primaryActionLabel: string;
  statusLabel: string;
  title: string;
};

export type TotpEnrollmentNextRoute = {
  params: { factorId: string; flow?: "enrollment" };
  pathname: "/auth/backup-codes" | "/auth/verify-totp";
};

export function createTotpEnrollmentViewModel(
  flow: TotpEnrollmentFlow = "onboarding",
): TotpEnrollmentViewModel {
  return {
    body:
      flow === "sign-in"
        ? "Your account needs a second lock before your vault opens. Scan this with an authenticator app (like Google Authenticator or 1Password), or type the setup key into it."
        : "Scan this with an authenticator app (like Google Authenticator or 1Password). Even if someone learns your password, they can't get in without this.",
    primaryActionLabel: "I've added it",
    statusLabel: "Security · Step 1 of 3",
    title: "Add your second lock",
  };
}

/** Where the real factor goes next: sign-up shows backup codes first; sign-in proves the code straight away. */
export function totpEnrollmentNextRoute(
  flow: TotpEnrollmentFlow,
  factorId: string,
): TotpEnrollmentNextRoute {
  return flow === "sign-in"
    ? { params: { factorId, flow: "enrollment" }, pathname: "/auth/verify-totp" }
    : { params: { factorId }, pathname: "/auth/backup-codes" };
}
