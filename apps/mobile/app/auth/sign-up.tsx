import { EmailPasswordAuthForm } from "@/features/auth";
import { Screen } from "@/shared/ui";

export default function SignUpRoute() {
  return (
    <Screen>
      <EmailPasswordAuthForm mode="sign-up" />
    </Screen>
  );
}
