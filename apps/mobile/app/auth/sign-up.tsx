import { Stack } from "expo-router/stack";
import { ScrollView } from "react-native";

import { EmailPasswordAuthForm } from "@/features/auth";
import { screenStyles } from "@/shared/ui/screen";

export default function SignUpRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Create account" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <EmailPasswordAuthForm mode="sign-up" />
      </ScrollView>
    </>
  );
}
