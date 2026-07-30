import { VaultAddMenu, useVaultSession } from "@/features/vault";
import { VaultBottomNavigation } from "@/features/vault/components/vault-bottom-navigation";
import { MutedText, Screen } from "@/shared/ui";

export default function VaultAddRoute() {
  const { isReady } = useVaultSession();

  return (
    <Screen
      fixedBottom={
        isReady ? <VaultBottomNavigation active="add" /> : undefined
      }
    >
      {isReady ? (
        <VaultAddMenu />
      ) : (
        <MutedText style={{ fontSize: 17 }}>Opening vault...</MutedText>
      )}
    </Screen>
  );
}
