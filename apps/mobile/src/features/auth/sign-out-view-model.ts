export type SignOutViewModel = {
  actionLabel: string;
  confirmationBody: string;
  confirmationTitle: string;
  title: string;
};

export function createSignOutViewModel(): SignOutViewModel {
  return {
    actionLabel: "Sign out",
    confirmationBody:
      "You will need your email, password, and two-factor code to sign back in.",
    confirmationTitle: "Sign out of your vault?",
    title: "Session",
  };
}
