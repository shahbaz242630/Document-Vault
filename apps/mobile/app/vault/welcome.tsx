import { VaultReadyPanel } from "@/features/onboarding";
import { Screen } from "@/shared/ui";

export default function VaultWelcomeRoute() {
  return (
    <Screen>
      <VaultReadyPanel />
    </Screen>
  );
}
