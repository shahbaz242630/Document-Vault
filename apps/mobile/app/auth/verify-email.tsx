import { EmailVerificationPanel, useSignupProgressStep } from "@/features/auth";
import { Screen } from "@/shared/ui";
import * as ExpoSecureStore from "expo-secure-store";

export default function VerifyEmailRoute() {
  useSignupProgressStep("verify-email", ExpoSecureStore);

  return (
    <Screen>
      <EmailVerificationPanel />
    </Screen>
  );
}
