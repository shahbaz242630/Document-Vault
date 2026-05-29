import { Stack, useLocalSearchParams } from "expo-router";
import { lazy, Suspense } from "react";
import { ScrollView } from "react-native";

import { useSignupProgressStep } from "@/features/auth";
import { screenStyles } from "@/shared/ui/screen";
import * as ExpoSecureStore from "expo-secure-store";

const TotpVerifyPanel = lazy(() =>
  import("@/features/auth/components/totp-verify-panel").then((m) => ({
    default: m.TotpVerifyPanel,
  })),
);

export default function VerifyTotpRoute() {
  useSignupProgressStep("verify-totp", ExpoSecureStore);
  const params = useLocalSearchParams<{ factorId?: string }>();
  const factorId = params.factorId ?? "";

  return (
    <>
      <Stack.Screen options={{ title: "Verify code" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <Suspense fallback={null}>
          <TotpVerifyPanel factorId={factorId} />
        </Suspense>
      </ScrollView>
    </>
  );
}
