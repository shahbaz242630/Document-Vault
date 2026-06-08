import { useEffect, useMemo, useState } from "react";
import { Stack } from "expo-router/stack";
import { Alert, ScrollView } from "react-native";
import * as SecureStore from "expo-secure-store";

import { defaultAuditLog } from "@/features/auth/audit-log";
import { EmergencyAccessScreen, type SealedCodeSetupStatus } from "@/features/settings";
import {
  createSupabaseEmergencyGrantRepository,
  type SupabaseEmergencyGrantClient,
  useVaultSession,
} from "@/features/vault";
import { createSupabaseClient } from "@/shared/api/supabase-client";
import { screenStyles } from "@/shared/ui/screen";

const pendingConfirmationKey = "sanduqkin.sealedEmergencyCode.pendingConfirmation";

export default function EmergencyAccessRoute() {
  const vaultSession = useVaultSession();
  const supabaseClient = useMemo(() => createSupabaseClient(), []);
  const repository = useMemo(
    () =>
      supabaseClient
        ? createSupabaseEmergencyGrantRepository(
            supabaseClient as unknown as SupabaseEmergencyGrantClient,
          )
        : null,
    [supabaseClient],
  );
  const [status, setStatus] = useState<SealedCodeSetupStatus>("none");
  const [oneTimeCode, setOneTimeCode] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadInterruptedSetup() {
      if (!repository) {
        return;
      }

      const pending = await SecureStore.getItemAsync(pendingConfirmationKey);
      const activeGrant = pending
        ? await repository.loadActiveSealedCodeGrant()
        : null;

      if (isMounted && pending && activeGrant) {
        setStatus("interrupted");
      }
    }

    void loadInterruptedSetup();

    return () => {
      isMounted = false;
    };
  }, [repository]);

  return (
    <>
      <Stack.Screen options={{ title: "Emergency access" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <EmergencyAccessScreen
          activeSealedCodeStatus={status}
          isBusy={isBusy}
          oneTimeCode={oneTimeCode}
          onConfirmSealedCodeWritten={confirmSealedCodeWritten}
          onCreateSealedCode={createSealedCode}
          onRegenerateSealedCode={regenerateSealedCode}
          onRevokeSealedCode={revokeSealedCode}
        />
      </ScrollView>
    </>
  );

  async function createSealedCode() {
    if (!repository) {
      Alert.alert("Setup unavailable", "Connect to Sanduqkin before creating a code.");
      return;
    }

    await runSetupAction(async () => {
      await SecureStore.setItemAsync(pendingConfirmationKey, "true");
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
    void SecureStore.deleteItemAsync(pendingConfirmationKey);
  }

  async function regenerateSealedCode() {
    if (!repository) {
      Alert.alert("Setup unavailable", "Connect to Sanduqkin before regenerating a code.");
      return;
    }

    await runSetupAction(async () => {
      await SecureStore.setItemAsync(pendingConfirmationKey, "true");
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
      await SecureStore.deleteItemAsync(pendingConfirmationKey);
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
