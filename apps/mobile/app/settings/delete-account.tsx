import { Stack } from "expo-router/stack";
import { lazy, Suspense } from "react";
import { ScrollView } from "react-native";

import { useVaultSession } from "@/features/vault";
import { screenStyles } from "@/shared/ui/screen";
import * as ExpoSecureStore from "expo-secure-store";

const AccountDeletionPanel = lazy(() =>
  import("@/features/auth/components/account-deletion-panel").then((m) => ({
    default: m.AccountDeletionPanel,
  })),
);

export default function DeleteAccountRoute() {
  const { lock } = useVaultSession();

  return (
    <>
      <Stack.Screen options={{ title: "Delete account" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <Suspense fallback={null}>
          <AccountDeletionPanel lockVault={lock} storage={ExpoSecureStore} />
        </Suspense>
      </ScrollView>
    </>
  );
}
