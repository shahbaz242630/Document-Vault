
import { VaultExportScreen, useVaultSession } from "@/features/vault";
import { Screen } from "@/shared/ui";

export default function VaultExportRoute() {
  const { assets, encryptedRecords, isReady } = useVaultSession();

  return (
    <Screen>
        <VaultExportScreen
          assets={assets}
          encryptedRecords={encryptedRecords}
          isReady={isReady}
        />
      </Screen>
  );
}
