export type EmailVerificationViewModel = {
  body: string;
  destinationLabel: string;
  title: string;
};

export function createEmailVerificationViewModel(
  email?: string,
): EmailVerificationViewModel {
  return {
    body:
      "It confirms this address is really yours. Open the link we sent, then continue below.",
    destinationLabel: normalizeEmailForDisplay(email) ?? "your email",
    title: "Check your email",
  };
}

function normalizeEmailForDisplay(email?: string): string | null {
  const normalized = email?.trim().toLowerCase();

  return normalized ? normalized : null;
}
