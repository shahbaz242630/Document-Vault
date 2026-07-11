import { EmailPasswordAuthForm } from "@/features/auth";
import { Screen } from "@/shared/ui";

export default function SignInRoute() {
  return (
    <Screen>
      <EmailPasswordAuthForm mode="sign-in" />
    </Screen>
  );
}
