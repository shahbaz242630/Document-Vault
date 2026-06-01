import { useEffect, useMemo, useState } from "react";
import * as ExpoLocalAuthentication from "expo-local-authentication";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import { createBiometricAuthService } from "../biometric-auth-service";
import { createBiometricPreferenceService } from "../biometric-preference-service";
import { createBiometricStorage } from "../biometric-storage";
import { createMekStorage } from "../mek-storage";

type SecureStorage = {
  deleteItemAsync: (key: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

type BiometricPreferencesPanelProps = {
  storage: SecureStorage | null;
};

export function BiometricPreferencesPanel({ storage }: BiometricPreferencesPanelProps) {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const biometricAuth = useMemo(
    () => createBiometricAuthService(ExpoLocalAuthentication),
    [],
  );
  const biometricStorage = useMemo(() => createBiometricStorage(storage), [storage]);
  const service = useMemo(
    () =>
      createBiometricPreferenceService({
        biometricAuth,
        biometricStorage,
        mekStorage: createMekStorage(storage),
      }),
    [biometricAuth, biometricStorage, storage],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadState() {
      const [support, storedEnabled] = await Promise.all([
        biometricAuth.checkSupport(),
        biometricStorage.isEnabled(),
      ]);

      if (isMounted) {
        setAvailable(support.available);
        setEnrolled(support.enrolled);
        setEnabled(storedEnabled);
      }
    }

    void loadState();

    return () => {
      isMounted = false;
    };
  }, [biometricAuth, biometricStorage]);

  const canEnable = available && enrolled;

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700" }}>
        Biometric unlock
      </Text>
      <Text style={{ color: colors.inkSoft, fontSize: 15, lineHeight: 22 }}>
        {enabled
          ? "Enabled on this device."
          : canEnable
            ? "Use this device's enrolled biometrics for app unlock."
            : available
              ? "No biometrics are enrolled on this device."
              : "Biometric authentication is not available on this device."}
      </Text>

      {error ? (
        <Text selectable style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}>
          {error}
        </Text>
      ) : null}

      {enabled ? (
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={async () => {
            setError(null);
            setIsBusy(true);
            try {
              await service.disable();
              setEnabled(false);
            } finally {
              setIsBusy(false);
            }
          }}
          style={{ alignItems: "center", paddingHorizontal: 18, paddingVertical: 14 }}
        >
          <Text style={{ color: colors.danger, fontSize: 17, textAlign: "center" }}>
            Disable biometric unlock
          </Text>
        </Pressable>
      ) : canEnable ? (
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={async () => {
            setError(null);
            setIsBusy(true);
            try {
              const result = await service.enable();

              if (result.status === "enabled") {
                setEnabled(true);
              } else {
                setError(result.message);
              }
            } finally {
              setIsBusy(false);
            }
          }}
          style={{
            alignItems: "center",
            backgroundColor: colors.action,
            borderCurve: "continuous",
            borderRadius: 8,
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}
        >
          <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
            Enable biometric unlock
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
