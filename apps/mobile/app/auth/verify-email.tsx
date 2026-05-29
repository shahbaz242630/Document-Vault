import { Stack } from "expo-router/stack";
import { ScrollView } from "react-native";

import { EmailVerificationPanel } from "@/features/auth";
import { useSignupProgressStep } from "@/features/auth";
import { screenStyles } from "@/shared/ui/screen";
import * as ExpoSecureStore from "expo-secure-store";

export default function VerifyEmailRoute() {
  useSignupProgressStep("verify-email", ExpoSecureStore);

  return (
    <>
      <Stack.Screen options={{ title: "Verify email" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <EmailVerificationPanel />
      </ScrollView>
    </>
  );
}
