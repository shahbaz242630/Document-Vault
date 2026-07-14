import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { colors } from "@/shared/theme/colors";
import {
  ErrorText,
  PrimaryButton,
  SerifTitle,
  StepHeader,
  Subtitle,
  TextButton,
} from "@/shared/ui";

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
  const [enabled, setEnabled] = useState(false);
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
    <View style={{ flex: 1, gap: 22 }}>
      <StepHeader step="recovery-3" />

      <View
        style={{
          alignItems: "center",
          flex: 1,
          gap: 24,
          justifyContent: "center",
        }}
      >
        <BiometricGlyph active={enabled} />
        <View style={{ alignItems: "center", gap: 10, maxWidth: 300 }}>
          <SerifTitle size={28} style={{ textAlign: "center" }}>
            {enabled ? "Biometric unlock is on" : viewModel.title}
          </SerifTitle>
          <Subtitle style={{ textAlign: "center" }}>
            {enabled
              ? "From now on, this is the fastest key to your vault."
              : getBiometricSetupBody(support, viewModel)}
          </Subtitle>
          {error ? <ErrorText>{error}</ErrorText> : null}
        </View>
      </View>

      <View style={{ gap: 14 }}>
        {canEnable ? (
          <PrimaryButton
            label={viewModel.primaryActionLabel}
            onPress={() => {
              void enableBiometrics();
            }}
          />
        ) : null}
        <TextButton
          color={colors.inkMuted}
          label={viewModel.skipActionLabel}
          onPress={() => {
            void finishSetup();
          }}
        />
      </View>
    </View>
  );

  async function enableBiometrics() {
    setError(null);
    const result = await biometricAuth.authenticate();

    if (result.status === "success") {
      await biometricStorage.setEnabled(true);
      setEnabled(true);
      setTimeout(() => {
        void finishSetup();
      }, 900);
    } else if (result.status === "error") {
      setError(result.message);
    }
  }

  async function finishSetup() {
    const progressStorage = createSignupProgressStorage(storage);
    await progressStorage.clear();
    router.replace("/vault/welcome");
  }
}

function BiometricGlyph({ active }: { active: boolean }) {
  const borderColor = active ? colors.action : colors.gold;

  return (
    <View
      style={{
        alignItems: "center",
        borderColor,
        borderCurve: "continuous",
        borderRadius: 24,
        borderWidth: 2,
        height: 84,
        justifyContent: "center",
        width: 84,
      }}
    >
      <View
        style={{
          borderColor,
          borderRadius: 99,
          borderWidth: 2,
          height: 34,
          width: 34,
        }}
      />
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
