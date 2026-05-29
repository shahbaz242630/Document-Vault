import { Stack } from "expo-router/stack";
import { ScrollView } from "react-native";

import { ForgotPasswordPanel } from "@/features/auth";
import { screenStyles } from "@/shared/ui/screen";

export default function ForgotPasswordRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Forgot password" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <ForgotPasswordPanel />
      </ScrollView>
    </>
  );
}
