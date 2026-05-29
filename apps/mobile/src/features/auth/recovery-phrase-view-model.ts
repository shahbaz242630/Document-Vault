export type RecoveryPhraseViewModel = {
  body: string;
  primaryActionLabel: string;
  statusLabel: string;
  title: string;
  warning: string;
};

export function createRecoveryPhraseViewModel(): RecoveryPhraseViewModel {
  return {
    body: "Write these 12 words down on paper and store them somewhere safe. Do not screenshot them. Do not store them in a password manager. If you forget your password, this phrase is required to restore your existing vault contents. Without it, you can reset your account and start fresh, but your previous vault contents cannot be decrypted.",
    primaryActionLabel: "I have written it down",
    statusLabel: "Required security step",
    title: "Save your recovery phrase",
    warning:
      "Sanduqkin cannot recover your data without this phrase. There is no reset button we can press.",
  };
}
