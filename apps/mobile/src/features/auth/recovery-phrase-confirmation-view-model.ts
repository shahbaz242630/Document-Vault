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
    body: "Pick the right word for each position — just to be sure your copy is correct.",
    inputPlaceholder: "Enter the word",
    primaryActionLabel: "Confirm",
    statusLabel: "Recovery · Step 2 of 3",
    successMessage: "Recovery phrase confirmed. Your vault is now secure.",
    title: "A quick check",
  };
}
