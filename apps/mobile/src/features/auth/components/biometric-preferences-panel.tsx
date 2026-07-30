import { useCallback, useMemo, useState } from "react";
import * as ExpoLocalAuthentication from "expo-local-authentication";
import { useFocusEffect } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";

import { defaultAuditLog } from "../audit-log";
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
  const preferences = useBiometricPreferences(storage);

  return (
    <View style={biometricPanelStyle}>
      <BiometricPreferenceStatus
        available={preferences.available}
        canEnable={preferences.canEnable}
        enabled={preferences.enabled}
        isCheckingSupport={preferences.isCheckingSupport}
      />

      {preferences.error ? (
        <Text selectable style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}>
          {preferences.error}
        </Text>
      ) : null}

      {preferences.enabled ? (
        <DisableBiometricButton
          disabled={preferences.isBusy}
          onDisable={preferences.disable}
        />
      ) : preferences.canEnable ? (
        <EnableBiometricButton
          disabled={preferences.isBusy}
          onEnable={preferences.enable}
        />
      ) : null}
    </View>
  );
}

function useBiometricPreferences(storage: SecureStorage | null) {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isCheckingSupport, setIsCheckingSupport] = useState(true);
  const { biometricAuth, biometricStorage, service } =
    useBiometricPreferenceServices(storage);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadState() {
        setIsCheckingSupport(true);
        try {
          const [support, storedEnabled] = await Promise.all([
            biometricAuth.checkSupport(),
            biometricStorage.isEnabled(),
          ]);

          if (isMounted) {
            setAvailable(support.available);
            setEnrolled(support.enrolled);
            setEnabled(storedEnabled);
          }
        } catch {
          if (isMounted) {
            setError(
              "Biometric availability could not be checked. Please reopen Settings and try again.",
            );
          }
        } finally {
          if (isMounted) {
            setIsCheckingSupport(false);
          }
        }
      }

      void loadState();

      return () => {
        isMounted = false;
      };
    }, [biometricAuth, biometricStorage]),
  );

  async function disable() {
    setError(null);
    setIsBusy(true);
    try {
      await service.disable();
      defaultAuditLog.log({
        deviceInfo: "React Native",
        eventType: "biometric_unlock_disabled",
      });
      setEnabled(false);
    } catch {
      setError("Biometric unlock could not be disabled. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function enable() {
    setError(null);
    setIsBusy(true);
    try {
      const result = await service.enable();
      if (result.status === "enabled") {
        defaultAuditLog.log({
          deviceInfo: "React Native",
          eventType: "biometric_unlock_enabled",
        });
        setEnabled(true);
      } else {
        setError(result.message);
      }
    } catch {
      setError(
        "Biometric unlock could not be enabled. Check this device's biometric settings and try again.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  return {
    available,
    canEnable: available && enrolled,
    disable,
    enable,
    enabled,
    error,
    isCheckingSupport,
    isBusy,
  };
}

function useBiometricPreferenceServices(storage: SecureStorage | null) {
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

  return { biometricAuth, biometricStorage, service };
}

function BiometricPreferenceStatus({
  available,
  canEnable,
  enabled,
  isCheckingSupport,
}: {
  available: boolean;
  canEnable: boolean;
  enabled: boolean;
  isCheckingSupport: boolean;
}) {
  return (
    <>
      <Text style={{ color: colors.ink, fontFamily: fonts.sans.medium, fontSize: 16 }}>
        Biometric unlock
      </Text>
      <Text
        style={{
          color: colors.inkSecondary,
          fontFamily: fonts.sans.regular,
          fontSize: 14.5,
          lineHeight: 21,
        }}
      >
        {getBiometricPreferenceBody({
          available,
          canEnable,
          enabled,
          isCheckingSupport,
        })}
      </Text>
    </>
  );
}

function getBiometricPreferenceBody({
  available,
  canEnable,
  enabled,
  isCheckingSupport,
}: {
  available: boolean;
  canEnable: boolean;
  enabled: boolean;
  isCheckingSupport: boolean;
}) {
  if (isCheckingSupport) return "Checking biometric availability...";
  if (enabled && canEnable) return "Enabled on this device.";
  if (enabled) {
    return "Biometric unlock needs attention. Check this device's biometric settings, then disable and re-enable it.";
  }
  if (canEnable) return "Use this device's enrolled biometrics for app unlock.";
  if (available) return "No biometrics are enrolled on this device.";
  return "Biometric authentication is not available on this device.";
}

function DisableBiometricButton({
  disabled,
  onDisable,
}: {
  disabled: boolean;
  onDisable: () => Promise<void>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        void onDisable();
      }}
      style={{ alignItems: "center", paddingHorizontal: 18, paddingVertical: 14 }}
    >
      <Text style={{ color: colors.danger, fontSize: 17, textAlign: "center" }}>
        Disable biometric unlock
      </Text>
    </Pressable>
  );
}

function EnableBiometricButton({
  disabled,
  onEnable,
}: {
  disabled: boolean;
  onEnable: () => Promise<void>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        void onEnable();
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
  );
}

const biometricPanelStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderCurve: "continuous" as const,
  borderRadius: 14,
  borderWidth: 1,
  gap: 10,
  padding: 18,
};
