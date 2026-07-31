import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { defaultAuditLog } from "@/features/auth/audit-log";
import { EmergencyAccessScreen, type SealedCodeSetupStatus } from "@/features/settings";
import {
  createSupabaseEmergencyGrantRepository,
  emergencyAccessPendingConfirmationKey,
  type SupabaseEmergencyGrantClient,
  useVaultSession,
} from "@/features/vault";
import { Screen } from "@/shared/ui";

export default function EmergencyAccessRoute() {
  const router = useRouter();
  const setupState = useEmergencyAccessSetupState();

  return (
    <Screen>
      <EmergencyAccessScreen
        activeSealedCodeStatus={setupState.status}
        isBusy={setupState.isBusy}
        oneTimeCode={setupState.oneTimeCode}
        onConfirmSealedCodeWritten={setupState.confirmSealedCodeWritten}
        onCreateSealedCode={setupState.createSealedCode}
        onOpenTrustedPerson={() =>
          router.push("/settings/trusted-person" as unknown as "/settings/re-auth")
        }
        onRegenerateSealedCode={setupState.regenerateSealedCode}
        onRevokeSealedCode={setupState.revokeSealedCode}
      />
    </Screen>
  );
}

function useEmergencyAccessSetupState() {
  const vaultSession = useVaultSession();
  const repository = useEmergencyGrantRepository();
  const [status, setStatus] = useState<SealedCodeSetupStatus>("none");
  const [oneTimeCode, setOneTimeCode] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useInterruptedSetupStatus({ repository, setStatus });

  return {
    confirmSealedCodeWritten,
    createSealedCode,
    isBusy,
    oneTimeCode,
    regenerateSealedCode,
    revokeSealedCode,
    status,
  };

  async function createSealedCode() {
    if (!repository) {
      Alert.alert("Setup unavailable", "Connect to Sanduqkin before creating a code.");
      return;
    }

    await runSetupAction(async () => {
      await SecureStore.setItemAsync(emergencyAccessPendingConfirmationKey, "true");
      const result = await vaultSession.createSealedEmergencyCodeSetup(repository, {
        auditLog: defaultAuditLog,
      });
      setOneTimeCode(result.code);
      setStatus(result.status);
    });
  }

  function confirmSealedCodeWritten() {
    setOneTimeCode(null);
    setStatus("active");
    void SecureStore.deleteItemAsync(emergencyAccessPendingConfirmationKey);
  }

  async function regenerateSealedCode() {
    if (!repository) {
      Alert.alert("Setup unavailable", "Connect to Sanduqkin before regenerating a code.");
      return;
    }

    await runSetupAction(async () => {
      await SecureStore.setItemAsync(emergencyAccessPendingConfirmationKey, "true");
      const result = await vaultSession.regenerateSealedEmergencyCodeSetup(repository, {
        auditLog: defaultAuditLog,
      });
      setOneTimeCode(result.code);
      setStatus(result.status);
    });
  }

  async function revokeSealedCode() {
    if (!repository) {
      Alert.alert("Setup unavailable", "Connect to Sanduqkin before revoking a code.");
      return;
    }

    await runSetupAction(async () => {
      await vaultSession.revokeSealedEmergencyCodeSetup(repository, {
        auditLog: defaultAuditLog,
      });
      await SecureStore.deleteItemAsync(emergencyAccessPendingConfirmationKey);
      setOneTimeCode(null);
      setStatus("none");
    });
  }

  async function runSetupAction(action: () => Promise<void>) {
    setIsBusy(true);
    try {
      await action();
    } catch {
      Alert.alert("Emergency access", "We could not update emergency access.");
    } finally {
      setIsBusy(false);
    }
  }
}

function useEmergencyGrantRepository() {
  const vaultSession = useVaultSession();

  return useMemo(
    () =>
      vaultSession.supabaseClient
        ? createSupabaseEmergencyGrantRepository(
            vaultSession.supabaseClient as unknown as SupabaseEmergencyGrantClient,
          )
        : null,
    [vaultSession.supabaseClient],
  );
}

function useInterruptedSetupStatus({
  repository,
  setStatus,
}: {
  repository: ReturnType<typeof useEmergencyGrantRepository>;
  setStatus: (status: SealedCodeSetupStatus) => void;
}) {
  useEffect(() => {
    let isMounted = true;

    async function loadInterruptedSetup() {
      if (!repository) {
        return;
      }

      const [pending, activeGrant] = await Promise.all([
        SecureStore.getItemAsync(emergencyAccessPendingConfirmationKey),
        repository.loadActiveSealedCodeGrant(),
      ]);

      if (isMounted && activeGrant) {
        setStatus(pending ? "interrupted" : "active");
      }
    }

    void loadInterruptedSetup();

    return () => {
      isMounted = false;
    };
  }, [repository, setStatus]);
}
