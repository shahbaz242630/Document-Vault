import { VaultDashboard, useVaultSession } from "@/features/vault";
import { MutedText, Screen } from "@/shared/ui";

export default function VaultRoute() {
  const { assets, isReady } = useVaultSession();

  return (
    <Screen>
      {isReady ? (
        <VaultDashboard assets={assets} />
      ) : (
        <MutedText style={{ fontSize: 17 }}>Opening vault...</MutedText>
      )}
    </Screen>
  );
}
