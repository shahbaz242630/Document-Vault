import { Stack } from "expo-router/stack";
import { lazy, Suspense } from "react";
import { ScrollView } from "react-native";

import { screenStyles } from "@/shared/ui/screen";

const TotpEnrollmentPanel = lazy(() =>
  import("@/features/auth/components/totp-enrollment-panel").then((m) => ({
    default: m.TotpEnrollmentPanel,
  })),
);

export default function SetupTotpRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Two-factor setup" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <Suspense fallback={null}>
          <TotpEnrollmentPanel />
        </Suspense>
      </ScrollView>
    </>
  );
}
