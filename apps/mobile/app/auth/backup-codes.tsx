import { Stack, useLocalSearchParams } from "expo-router";
import { lazy, Suspense } from "react";
import { ScrollView } from "react-native";

import { useSignupProgressStep } from "@/features/auth";
import { screenStyles } from "@/shared/ui/screen";
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
    <>
      <Stack.Screen options={{ title: "Backup codes" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <Suspense fallback={null}>
          <BackupCodesPanel factorId={factorId} />
        </Suspense>
      </ScrollView>
    </>
  );
}
