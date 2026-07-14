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
      "We can't reset it for you — by design, we hold nothing that opens your vault. But your recovery phrase can. We'll email you a link to start.",
    emailLabel: "Email",
    primaryActionLabel: "Email me a reset link",
    recoverWithPhraseLabel: "I have my recovery phrase",
    resetWithoutDataLabel: "I don't have my recovery phrase",
    title: "Forgot your password?",
    unavailableMessage:
      "Supabase is not configured yet. Use the options below to reset locally.",
  };
}
