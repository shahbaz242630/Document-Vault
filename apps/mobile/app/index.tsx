import { WelcomePanel } from "@/features/onboarding/components/welcome-panel";
import { Screen } from "@/shared/ui";

export default function HomeRoute() {
  return (
    <Screen animateIn={false}>
      <WelcomePanel />
    </Screen>
  );
}
