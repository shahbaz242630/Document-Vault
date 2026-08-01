type BiometricPreferenceAction = {
  enabled: boolean;
  onDisable: () => Promise<void>;
  onEnable: () => Promise<void>;
};

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
