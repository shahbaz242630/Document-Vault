import { lazy, Suspense } from "react";
import { useLocalSearchParams } from "expo-router";

import { Screen } from "@/shared/ui";

const TotpEnrollmentPanel = lazy(() =>
  import("@/features/auth/components/totp-enrollment-panel").then((m) => ({
    default: m.TotpEnrollmentPanel,
  })),
);

export default function SetupTotpRoute() {
  const params = useLocalSearchParams<{ flow?: string }>();
  const flow = params.flow === "sign-in" ? "sign-in" : "onboarding";

  return (
    <Screen>
      <Suspense fallback={null}>
        <TotpEnrollmentPanel flow={flow} />
      </Suspense>
    </Screen>
  );
}
