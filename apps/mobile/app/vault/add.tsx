import { VaultAddMenu, useVaultSession } from "@/features/vault";
import { MutedText, Screen } from "@/shared/ui";

export default function VaultAddRoute() {
  const { isReady } = useVaultSession();

  return (
    <Screen>
      {isReady ? (
        <VaultAddMenu />
      ) : (
        <MutedText style={{ fontSize: 17 }}>Opening vault...</MutedText>
      )}
    </Screen>
  );
}
