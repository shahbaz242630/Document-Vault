export type BackupCodesViewModel = {
  acknowledgmentLabel: string;
  body: string;
  codes: readonly string[];
  primaryActionLabel: string;
  statusLabel: string;
  title: string;
  warning: string;
};

export function createBackupCodesViewModel(): BackupCodesViewModel {
  return {
    acknowledgmentLabel: "I've saved these somewhere safe",
    body: "If you ever lose your authenticator app, any one of these gets you in. Keep them somewhere safe — each works once.",
    codes: [
      "ABCD-1234-EFGH",
      "IJKL-5678-MNOP",
      "QRST-9012-UVWX",
      "YZAB-3456-CDEF",
      "GHIJ-7890-KLMN",
      "OPQR-1234-STUV",
    ],
    primaryActionLabel: "Continue",
    statusLabel: "Security · Step 2 of 3",
    title: "Your backup codes",
    warning:
      "Sanduqkin cannot reset your two-factor authentication without these codes or your recovery phrase.",
  };
}
