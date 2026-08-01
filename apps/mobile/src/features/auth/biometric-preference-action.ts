type BiometricPreferenceAction = {
  enabled: boolean;
  onDisable: () => Promise<void>;
  onEnable: () => Promise<void>;
};

type BiometricPreferenceControlInput = {
  canEnable: boolean;
  enabled: boolean;
  isBusy: boolean;
  isCheckingSupport: boolean;
};

type BiometricPreferenceControlState = {
  actionColor: "action" | "danger" | "inkSecondary";
  disabled: boolean;
  hint: string;
  label: string;
};

export function getBiometricPreferenceControlState({
  canEnable,
  enabled,
  isBusy,
  isCheckingSupport,
}: BiometricPreferenceControlInput): BiometricPreferenceControlState {
  if (isBusy) {
    return {
      actionColor: "inkSecondary",
      disabled: true,
      hint: "Wait for the biometric preference update to finish.",
      label: "Updating biometric unlock",
    };
  }

  if (isCheckingSupport) {
    return {
      actionColor: "inkSecondary",
      disabled: true,
      hint: "Wait while biometric availability is checked.",
      label: "Checking biometric availability",
    };
  }

  if (enabled) {
    return {
      actionColor: "danger",
      disabled: false,
      hint: "Removes biometric unlock from this device.",
      label: "Disable biometric unlock",
    };
  }

  if (canEnable) {
    return {
      actionColor: "action",
      disabled: false,
      hint: "Authenticates you before enabling biometric unlock on this device.",
      label: "Enable biometric unlock",
    };
  }

  return {
    actionColor: "inkSecondary",
    disabled: true,
    hint: "Set up biometrics in this device's settings before enabling biometric unlock.",
    label: "Biometric unlock unavailable",
  };
}

export async function runBiometricPreferenceAction({
  enabled,
  onDisable,
  onEnable,
}: BiometricPreferenceAction) {
  if (enabled) {
    await onDisable();
    return;
  }

  await onEnable();
}
