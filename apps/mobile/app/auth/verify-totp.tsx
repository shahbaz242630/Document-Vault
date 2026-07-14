import { lazy, Suspense } from "react";
import { useLocalSearchParams } from "expo-router";

import { useSignupProgressStep } from "@/features/auth";
import { Screen } from "@/shared/ui";
import * as ExpoSecureStore from "expo-secure-store";

const TotpVerifyPanel = lazy(() =>
  import("@/features/auth/components/totp-verify-panel").then((m) => ({
    default: m.TotpVerifyPanel,
  })),
);

export default function VerifyTotpRoute() {
  useSignupProgressStep("verify-totp", ExpoSecureStore);
  const params = useLocalSearchParams<{ factorId?: string; flow?: string }>();
  const factorId = params.factorId ?? "";
  const variant = params.flow === "returning" ? "returning" : "onboarding";

  return (
    <Screen>
      <Suspense fallback={null}>
        <TotpVerifyPanel factorId={factorId} variant={variant} />
      </Suspense>
    </Screen>
  );
}
