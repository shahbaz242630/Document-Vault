export type RecoveryPhraseConfirmationViewModel = {
  body: string;
  inputPlaceholder: string;
  primaryActionLabel: string;
  statusLabel: string;
  successMessage: string;
  title: string;
};

export function createRecoveryPhraseConfirmationViewModel(): RecoveryPhraseConfirmationViewModel {
  return {
    body: "Enter 3 words from your recovery phrase to confirm you saved them correctly.",
    inputPlaceholder: "Enter the word",
    primaryActionLabel: "Confirm and continue",
    statusLabel: "Required security step",
    successMessage: "Recovery phrase confirmed. Your vault is now secure.",
    title: "Confirm your recovery phrase",
  };
}
