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
      "Once Supabase email settings are ready, this step will confirm your email before two-factor setup.",
    destinationLabel: normalizeEmailForDisplay(email) ?? "your email",
    title: "Check your email",
  };
}

function normalizeEmailForDisplay(email?: string): string | null {
  const normalized = email?.trim().toLowerCase();

  return normalized ? normalized : null;
}
