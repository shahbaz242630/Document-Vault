import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";

import { ResetPasswordPanel } from "@/features/auth";
import { useVaultSession } from "@/features/vault";
import { screenStyles } from "@/shared/ui/screen";
import * as ExpoSecureStore from "expo-secure-store";

export default function ResetPasswordRoute() {
  const { mode } = useLocalSearchParams<{ mode: "recover" | "fresh" }>();
  const { lock } = useVaultSession();

  return (
    <>
      <Stack.Screen options={{ title: "Reset password" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <ResetPasswordPanel
          lockVault={lock}
          mode={mode ?? "recover"}
          storage={ExpoSecureStore}
        />
      </ScrollView>
    </>
  );
}
