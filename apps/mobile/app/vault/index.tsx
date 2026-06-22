import { Stack } from "expo-router/stack";
import { ScrollView, Text, View } from "react-native";

import { VaultDashboard , useVaultSession } from "@/features/vault";

import { colors } from "@/shared/theme/colors";
import { screenStyles } from "@/shared/ui/screen";

export default function VaultRoute() {
  const { assets, isReady } = useVaultSession();

  return (
    <>
      <Stack.Screen options={{ title: "Vault" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        {isReady ? (
          <View style={{ gap: 20 }}>
            <VaultDashboard assets={assets} />
          </View>
        ) : (
          <Text style={{ color: colors.inkMuted, fontSize: 17 }}>Opening vault...</Text>
        )}
      </ScrollView>
    </>
  );
}
