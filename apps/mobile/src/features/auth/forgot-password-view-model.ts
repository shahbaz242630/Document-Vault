export type ForgotPasswordViewModel = {
  body: string;
  emailLabel: string;
  primaryActionLabel: string;
  recoverWithPhraseLabel: string;
  resetWithoutDataLabel: string;
  title: string;
  unavailableMessage: string;
};

export function createForgotPasswordViewModel(): ForgotPasswordViewModel {
  return {
    body:
      "You have two options. If you saved your 12-word recovery phrase, you can recover your vault with a new password. If not, you can reset your account and start fresh.",
    emailLabel: "Email",
    primaryActionLabel: "Send reset email",
    recoverWithPhraseLabel: "I have my recovery phrase",
    resetWithoutDataLabel: "I don't have my recovery phrase",
    title: "Forgot your password?",
    unavailableMessage:
      "Supabase is not configured yet. Use the options below to reset locally.",
  };
}
