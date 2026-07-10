import { useEffect, useMemo, useState } from "react";
import * as ExpoLocalAuthentication from "expo-local-authentication";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

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
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const { biometricAuth, biometricStorage, service } =
    useBiometricPreferenceServices(storage);

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
      <BiometricPreferenceStatus
        available={available}
        canEnable={canEnable}
        enabled={enabled}
      />

      {error ? (
        <Text selectable style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}>
          {error}
        </Text>
      ) : null}

      {enabled ? (
        <DisableBiometricButton
          disabled={isBusy}
          onDisable={async () => {
            setError(null);
            setIsBusy(true);
            try {
              await service.disable();
              defaultAuditLog.log({
                deviceInfo: "React Native",
                eventType: "biometric_unlock_disabled",
              });
              setEnabled(false);
            } finally {
              setIsBusy(false);
            }
          }}
        />
      ) : canEnable ? (
        <EnableBiometricButton
          disabled={isBusy}
          onEnable={async () => {
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
            } finally {
              setIsBusy(false);
            }
          }}
        />
      ) : null}
    </View>
  );
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
}: {
  available: boolean;
  canEnable: boolean;
  enabled: boolean;
}) {
  return (
    <>
      <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700" }}>
        Biometric unlock
      </Text>
      <Text style={{ color: colors.inkSoft, fontSize: 15, lineHeight: 22 }}>
        {getBiometricPreferenceBody({ available, canEnable, enabled })}
      </Text>
    </>
  );
}

function getBiometricPreferenceBody({
  available,
  canEnable,
  enabled,
}: {
  available: boolean;
  canEnable: boolean;
  enabled: boolean;
}) {
  if (enabled) return "Enabled on this device.";
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
