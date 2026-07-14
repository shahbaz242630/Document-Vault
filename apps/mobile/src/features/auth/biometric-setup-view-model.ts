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
    body: "Skip typing your password every time. Your vault stays sealed either way.",
    enabledActionLabel: "Biometric unlock enabled",
    notAvailableBody: "This device does not support biometric authentication. You can still use your password and two-factor code to sign in.",
    notEnrolledBody: "No biometrics are enrolled on this device. Set up Face ID or fingerprint in your device settings first, then return here.",
    primaryActionLabel: "Enable biometric unlock",
    skipActionLabel: "Not now",
    statusLabel: "Recovery · Step 3 of 3",
    title: "Unlock with your face or fingerprint",
  };
}
