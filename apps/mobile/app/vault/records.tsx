import { VaultRecordsMenu, useVaultSession } from "@/features/vault";
import { VaultBottomNavigation } from "@/features/vault/components/vault-bottom-navigation";
import { MutedText, Screen } from "@/shared/ui";

export default function VaultRecordsRoute() {
  const { assets, isReady } = useVaultSession();

  return (
    <Screen
      fixedBottom={
        isReady ? <VaultBottomNavigation active="records" /> : undefined
      }
    >
      {isReady ? (
        <VaultRecordsMenu assets={assets} />
      ) : (
        <MutedText style={{ fontSize: 17 }}>Opening vault...</MutedText>
      )}
    </Screen>
  );
}
