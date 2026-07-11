import { lazy, Suspense } from "react";

import { Screen } from "@/shared/ui";

const TotpEnrollmentPanel = lazy(() =>
  import("@/features/auth/components/totp-enrollment-panel").then((m) => ({
    default: m.TotpEnrollmentPanel,
  })),
);

export default function SetupTotpRoute() {
  return (
    <Screen>
      <Suspense fallback={null}>
        <TotpEnrollmentPanel />
      </Suspense>
    </Screen>
  );
}
