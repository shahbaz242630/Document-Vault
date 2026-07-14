import { useLocalSearchParams } from "expo-router";

import { ProfileBasicsPanel, useSignupProgressStep } from "@/features/auth";
import { Screen } from "@/shared/ui";
import * as ExpoSecureStore from "expo-secure-store";

export default function ProfileBasicsRoute() {
  useSignupProgressStep("profile-basics", ExpoSecureStore);
  const params = useLocalSearchParams<{ email?: string }>();

  return (
    <Screen>
      <ProfileBasicsPanel email={params.email ?? ""} />
    </Screen>
  );
}
