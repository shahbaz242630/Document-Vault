import { lazy, Suspense } from "react";

import { Screen } from "@/shared/ui";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BiometricSetupPanel = lazy(() =>
  import("@/features/auth/components/biometric-setup-panel").then((m) => ({
    default: m.BiometricSetupPanel,
  })),
);

export default function SetupBiometricRoute() {
  return (
    <Screen>
      <Suspense fallback={null}>
        <BiometricSetupPanel
          hardware={LocalAuthentication}
          storage={SecureStore}
        />
      </Suspense>
    </Screen>
  );
}
