import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import { createBiometricAuthService } from "../biometric-auth-service";
import { createBiometricStorage } from "../biometric-storage";
import { createBiometricSetupViewModel } from "../biometric-setup-view-model";
import { createSignupProgressStorage } from "../signup-progress";

type BiometricHardware = {
  authenticateAsync: (
    options: Record<string, unknown>,
  ) => Promise<{ error?: string; success: boolean }>;
  hasHardwareAsync: () => Promise<boolean>;
  isEnrolledAsync: () => Promise<boolean>;
};

type SecureStorage = {
  deleteItemAsync: (key: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

type BiometricSetupPanelProps = {
  hardware: BiometricHardware | null;
  storage: SecureStorage | null;
};

type BiometricSetupViewModel = ReturnType<typeof createBiometricSetupViewModel>;
type BiometricSupport = {
  available: boolean;
  enrolled: boolean;
};

export function BiometricSetupPanel({ hardware, storage }: BiometricSetupPanelProps) {
  const viewModel = createBiometricSetupViewModel();
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const biometricAuth = useMemo(() => createBiometricAuthService(hardware), [hardware]);
  const biometricStorage = useMemo(() => createBiometricStorage(storage), [storage]);
  const router = useRouter();

  useEffect(() => {
    biometricAuth.checkSupport().then(setSupport);
  }, [biometricAuth]);

  if (!support) {
    return null;
  }

  const canEnable = support.available && support.enrolled;

  return (
    <View style={{ gap: 20 }}>
      <BiometricSetupHeader support={support} viewModel={viewModel} />

      {error ? (
        <Text selectable style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}>
          {error}
        </Text>
      ) : null}

      {canEnable ? (
        <BiometricEnableButton
          label={viewModel.primaryActionLabel}
          onEnable={async () => {
            setError(null);
            const result = await biometricAuth.authenticate();

            if (result.status === "success") {
              await biometricStorage.setEnabled(true);
              const progressStorage = createSignupProgressStorage(storage);
              await progressStorage.clear();
              router.replace("/vault/welcome");
              return;
            } else if (result.status === "error") {
              setError(result.message);
            }
          }}
        />
      ) : null}

      <BiometricSkipButton
        label={viewModel.skipActionLabel}
        onSkip={async () => {
          const progressStorage = createSignupProgressStorage(storage);
          await progressStorage.clear();
          router.replace("/vault/welcome");
        }}
      />
    </View>
  );
}

function BiometricSetupHeader({
  support,
  viewModel,
}: {
  support: BiometricSupport;
  viewModel: BiometricSetupViewModel;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
        {viewModel.statusLabel}
      </Text>
      <Text
        style={{
          color: colors.ink,
          fontSize: 30,
          fontWeight: "700",
          lineHeight: 36,
        }}
      >
        {viewModel.title}
      </Text>
      <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
        {getBiometricSetupBody(support, viewModel)}
      </Text>
    </View>
  );
}

function getBiometricSetupBody(
  support: BiometricSupport,
  viewModel: BiometricSetupViewModel,
) {
  if (!support.available) return viewModel.notAvailableBody;
  if (!support.enrolled) return viewModel.notEnrolledBody;
  return viewModel.body;
}

function BiometricEnableButton({
  label,
  onEnable,
}: {
  label: string;
  onEnable: () => Promise<void>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
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
        {label}
      </Text>
    </Pressable>
  );
}

function BiometricSkipButton({
  label,
  onSkip,
}: {
  label: string;
  onSkip: () => Promise<void>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        void onSkip();
      }}
      style={{ alignItems: "center", paddingHorizontal: 18, paddingVertical: 14 }}
    >
      <Text style={{ color: colors.inkMuted, fontSize: 17, textAlign: "center" }}>
        {label}
      </Text>
    </Pressable>
  );
}
