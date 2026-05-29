import { Stack } from "expo-router/stack";
import { ScrollView } from "react-native";

import { VaultReadyPanel } from "@/features/onboarding";
import { screenStyles } from "@/shared/ui/screen";

export default function VaultWelcomeRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Welcome" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <VaultReadyPanel />
      </ScrollView>
    </>
  );
}
