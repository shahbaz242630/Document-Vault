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
    acknowledgmentLabel: "I have saved these codes in a safe place.",
    body: "If you lose access to your authenticator app, these codes let you sign in. Each code can only be used once. Store them somewhere secure — not on this device.",
    codes: [
      "ABCD-1234-EFGH",
      "IJKL-5678-MNOP",
      "QRST-9012-UVWX",
      "YZAB-3456-CDEF",
      "GHIJ-7890-KLMN",
      "OPQR-1234-STUV",
    ],
    primaryActionLabel: "Continue to code verification",
    statusLabel: "Required security step",
    title: "Save your backup codes",
    warning:
      "Sanduqkin cannot reset your two-factor authentication without these codes or your recovery phrase.",
  };
}
