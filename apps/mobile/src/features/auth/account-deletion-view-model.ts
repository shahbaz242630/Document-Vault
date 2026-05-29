export type AccountDeletionViewModel = {
  confirmationInputLabel: string;
  confirmationPlaceholder: string;
  dangerActionLabel: string;
  title: string;
  warningBody: string;
  warningTitle: string;
};

export function createAccountDeletionViewModel(): AccountDeletionViewModel {
  return {
    confirmationInputLabel: "Type DELETE to confirm",
    confirmationPlaceholder: "DELETE",
    dangerActionLabel: "Permanently delete account",
    title: "Delete account",
    warningBody:
      "This will erase your vault, remove your encryption keys, and clear all local settings. This action cannot be undone.",
    warningTitle: "This is irreversible",
  };
}
