import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";

import { ProfileBasicsPanel } from "@/features/auth";
import { useSignupProgressStep } from "@/features/auth";
import { screenStyles } from "@/shared/ui/screen";
import * as ExpoSecureStore from "expo-secure-store";

export default function ProfileBasicsRoute() {
  useSignupProgressStep("profile-basics", ExpoSecureStore);
  const params = useLocalSearchParams<{ email?: string }>();

  return (
    <>
      <Stack.Screen options={{ title: "Profile basics" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <ProfileBasicsPanel email={params.email ?? ""} />
      </ScrollView>
    </>
  );
}
