import { Stack } from "expo-router";
import { lazy, Suspense } from "react";
import { ScrollView } from "react-native";

import { screenStyles } from "@/shared/ui/screen";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BiometricSetupPanel = lazy(() =>
  import("@/features/auth/components/biometric-setup-panel").then((m) => ({
    default: m.BiometricSetupPanel,
  })),
);

export default function SetupBiometricRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Biometric unlock" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <Suspense fallback={null}>
          <BiometricSetupPanel
            hardware={LocalAuthentication}
            storage={SecureStore}
          />
        </Suspense>
      </ScrollView>
    </>
  );
}
