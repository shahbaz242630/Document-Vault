import { Stack } from "expo-router/stack";
import { ScrollView } from "react-native";

import { EmailPasswordAuthForm } from "@/features/auth";
import { screenStyles } from "@/shared/ui/screen";

export default function SignInRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Sign in" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <EmailPasswordAuthForm mode="sign-in" />
      </ScrollView>
    </>
  );
}
