import { VaultDashboard, useVaultSession } from "@/features/vault";
import { VaultBottomNavigation } from "@/features/vault/components/vault-bottom-navigation";
import { MutedText, Screen } from "@/shared/ui";

export default function VaultRoute() {
  const { assets, isReady } = useVaultSession();

  return (
    <Screen
      fixedBottom={
        isReady ? <VaultBottomNavigation active="home" /> : undefined
      }
    >
      {isReady ? (
        <VaultDashboard assets={assets} />
      ) : (
        <MutedText style={{ fontSize: 17 }}>Opening vault...</MutedText>
      )}
    </Screen>
  );
}
