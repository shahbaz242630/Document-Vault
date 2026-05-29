export type ResetPasswordMode = "recover" | "fresh";

export type ResetPasswordViewModel = {
  confirmPasswordLabel: string;
  freshBody: string;
  freshTitle: string;
  freshWarning: string;
  newPasswordLabel: string;
  phraseInputLabel: string;
  phrasePlaceholder: string;
  primaryActionLabel: string;
  recoverBody: string;
  recoverTitle: string;
  verifyingLabel: string;
};

export function createResetPasswordViewModel(): ResetPasswordViewModel {
  return {
    confirmPasswordLabel: "Confirm new password",
    freshBody:
      "This will permanently delete all encrypted vault data, encryption keys, and local settings. Your account will be reset and you can start fresh. This action cannot be undone.",
    freshTitle: "Reset account",
    freshWarning: "This will erase everything. Your vault cannot be recovered.",
    newPasswordLabel: "New password",
    phraseInputLabel: "Recovery phrase",
    phrasePlaceholder: "word1 word2 word3 ...",
    primaryActionLabel: "Continue",
    recoverBody:
      "Enter your 12-word recovery phrase and a new password. Your vault data will be restored with the new password.",
    recoverTitle: "Recover your vault",
    verifyingLabel: "Working...",
  };
}
