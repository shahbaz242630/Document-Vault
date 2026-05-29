type BiometricHardware = {
  authenticateAsync: (
    options: Record<string, unknown>,
  ) => Promise<{ error?: string; success: boolean }>;
  hasHardwareAsync: () => Promise<boolean>;
  isEnrolledAsync: () => Promise<boolean>;
};

export type BiometricSupportResult = {
  available: boolean;
  enrolled: boolean;
};

export type BiometricAuthResult =
  | { status: "cancelled" }
  | { status: "error"; message: string }
  | { status: "success" };

export function createBiometricAuthService(hardware: BiometricHardware | null) {
  return {
    async checkSupport(): Promise<BiometricSupportResult> {
      if (!hardware) {
        return { available: false, enrolled: false };
      }

      const compatible = await hardware.hasHardwareAsync();
      const enrolled = compatible ? await hardware.isEnrolledAsync() : false;

      return { available: compatible, enrolled: compatible && enrolled };
    },

    async authenticate(): Promise<BiometricAuthResult> {
      if (!hardware) {
        return {
          message: "Biometric authentication is not available on this device.",
          status: "error",
        };
      }

      const result = await hardware.authenticateAsync({
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
        fallbackLabel: "Use passcode",
        promptMessage: "Unlock Sanduqkin",
      });

      if (!result.success) {
        if (result.error === "user_cancel") {
          return { status: "cancelled" };
        }

        return {
          message: "Biometric authentication failed. Try again or use your password.",
          status: "error",
        };
      }

      return { status: "success" };
    },
  };
}
