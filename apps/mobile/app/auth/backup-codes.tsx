import { lazy, Suspense } from "react";
import { useLocalSearchParams } from "expo-router";

import { useSignupProgressStep } from "@/features/auth";
import { Screen } from "@/shared/ui";
import * as ExpoSecureStore from "expo-secure-store";

const BackupCodesPanel = lazy(() =>
  import("@/features/auth/components/backup-codes-panel").then((m) => ({
    default: m.BackupCodesPanel,
  })),
);

export default function BackupCodesRoute() {
  useSignupProgressStep("backup-codes", ExpoSecureStore);
  const params = useLocalSearchParams<{ factorId?: string }>();
  const factorId = params.factorId ?? "";

  return (
    <Screen>
      <Suspense fallback={null}>
        <BackupCodesPanel factorId={factorId} />
      </Suspense>
    </Screen>
  );
}
