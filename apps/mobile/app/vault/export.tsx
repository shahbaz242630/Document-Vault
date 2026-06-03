import { Stack } from "expo-router/stack";
import { ScrollView } from "react-native";

import { VaultExportScreen, useVaultSession } from "@/features/vault";
import { screenStyles } from "@/shared/ui/screen";

export default function VaultExportRoute() {
  const { assets, isReady } = useVaultSession();

  return (
    <>
      <Stack.Screen options={{ title: "Vault export" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <VaultExportScreen assets={assets} isReady={isReady} />
      </ScrollView>
    </>
  );
}
