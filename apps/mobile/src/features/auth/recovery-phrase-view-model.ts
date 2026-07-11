export type RecoveryPhraseViewModel = {
  body: string;
  primaryActionLabel: string;
  statusLabel: string;
  title: string;
  warning: string;
};

export function createRecoveryPhraseViewModel(): RecoveryPhraseViewModel {
  return {
    body: "Twelve words that can restore your vault if you lose your phone or forget your password. Write them down, in order, on paper.",
    primaryActionLabel: "I've written it down",
    statusLabel: "Recovery · Step 1 of 3",
    title: "Your recovery phrase",
    warning:
      "Sanduqkin never sees these words. Anyone who has them can open your vault — treat them like a key.",
  };
}
