import { Stack } from "expo-router/stack";
import { ScrollView } from "react-native";

import { SettingsScreen } from "@/features/settings";
import { usePremiumStatus } from "@/features/payments";
import { useVaultSession } from "@/features/vault";
import { screenStyles } from "@/shared/ui/screen";
import * as ExpoSecureStore from "expo-secure-store";

export default function SettingsRoute() {
  const { signOut } = useVaultSession();
  const isPremium = usePremiumStatus();

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <SettingsScreen
          isPremium={isPremium}
          storage={ExpoSecureStore}
          vaultSignOut={signOut}
        />
      </ScrollView>
    </>
  );
}
