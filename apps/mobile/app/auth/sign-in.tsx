import { EmailPasswordAuthForm } from "@/features/auth/components/email-password-auth-form";
import { Screen } from "@/shared/ui";

export default function SignInRoute() {
  return (
    <Screen>
      <EmailPasswordAuthForm mode="sign-in" />
    </Screen>
  );
}
