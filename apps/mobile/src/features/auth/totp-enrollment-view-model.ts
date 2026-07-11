export type TotpEnrollmentViewModel = {
  body: string;
  primaryActionLabel: string;
  statusLabel: string;
  title: string;
};

export function createTotpEnrollmentViewModel(): TotpEnrollmentViewModel {
  return {
    body:
      "Scan this with an authenticator app (like Google Authenticator or 1Password). Even if someone learns your password, they can't get in without this.",
    primaryActionLabel: "I've added it",
    statusLabel: "Security · Step 1 of 3",
    title: "Add your second lock",
  };
}
