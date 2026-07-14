import { lazy, Suspense } from "react";

import { useVaultSession } from "@/features/vault";
import { Screen } from "@/shared/ui";
import * as ExpoSecureStore from "expo-secure-store";

const AccountDeletionPanel = lazy(() =>
  import("@/features/auth/components/account-deletion-panel").then((m) => ({
    default: m.AccountDeletionPanel,
  })),
);

export default function DeleteAccountRoute() {
  const { lock } = useVaultSession();

  return (
    <Screen>
      <Suspense fallback={null}>
        <AccountDeletionPanel lockVault={lock} storage={ExpoSecureStore} />
      </Suspense>
    </Screen>
  );
}
