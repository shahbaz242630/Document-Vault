export type BiometricSetupViewModel = {
  body: string;
  enabledActionLabel: string;
  notAvailableBody: string;
  notEnrolledBody: string;
  primaryActionLabel: string;
  skipActionLabel: string;
  statusLabel: string;
  title: string;
};

export function createBiometricSetupViewModel(): BiometricSetupViewModel {
  return {
    body: "Enable Face ID, Touch ID, or your device biometrics to unlock Sanduqkin quickly after your first sign-in. Your biometric data never leaves this device.",
    enabledActionLabel: "Biometric unlock enabled",
    notAvailableBody: "This device does not support biometric authentication. You can still use your password and two-factor code to sign in.",
    notEnrolledBody: "No biometrics are enrolled on this device. Set up Face ID or fingerprint in your device settings first, then return here.",
    primaryActionLabel: "Enable biometric unlock",
    skipActionLabel: "Skip for now",
    statusLabel: "Optional security step",
    title: "Quick unlock",
  };
}
