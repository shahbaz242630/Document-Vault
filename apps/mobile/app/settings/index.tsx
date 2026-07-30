import { SettingsScreen } from "@/features/settings";
import { usePremiumStatus } from "@/features/payments";
import { useVaultSession } from "@/features/vault";
import { VaultBottomNavigation } from "@/features/vault/components/vault-bottom-navigation";
import { Screen } from "@/shared/ui";
import * as ExpoSecureStore from "expo-secure-store";

export default function SettingsRoute() {
  const { signOut } = useVaultSession();
  const isPremium = usePremiumStatus();

  return (
    <Screen fixedBottom={<VaultBottomNavigation active="settings" />}>
      <SettingsScreen
        isPremium={isPremium}
        storage={ExpoSecureStore}
        vaultSignOut={signOut}
      />
    </Screen>
  );
}
