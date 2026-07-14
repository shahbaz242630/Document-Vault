import { useLocalSearchParams } from "expo-router";

import { ResetPasswordPanel } from "@/features/auth";
import { useVaultSession } from "@/features/vault";
import { Screen } from "@/shared/ui";
import * as ExpoSecureStore from "expo-secure-store";

export default function ResetPasswordRoute() {
  const { mode } = useLocalSearchParams<{ mode: "recover" | "fresh" }>();
  const { lock } = useVaultSession();

  return (
    <Screen>
      <ResetPasswordPanel
        lockVault={lock}
        mode={mode ?? "recover"}
        storage={ExpoSecureStore}
      />
    </Screen>
  );
}
