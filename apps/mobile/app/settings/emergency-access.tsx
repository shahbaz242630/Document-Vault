import { Stack } from "expo-router/stack";
import { ScrollView } from "react-native";

import { EmergencyAccessScreen } from "@/features/settings";
import { screenStyles } from "@/shared/ui/screen";

export default function EmergencyAccessRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Emergency access" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <EmergencyAccessScreen />
      </ScrollView>
    </>
  );
}
