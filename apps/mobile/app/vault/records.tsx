import { VaultRecordsMenu, useVaultSession } from "@/features/vault";
import { MutedText, Screen } from "@/shared/ui";

export default function VaultRecordsRoute() {
  const { assets, isReady } = useVaultSession();

  return (
    <Screen>
      {isReady ? (
        <VaultRecordsMenu assets={assets} />
      ) : (
        <MutedText style={{ fontSize: 17 }}>Opening vault...</MutedText>
      )}
    </Screen>
  );
}
