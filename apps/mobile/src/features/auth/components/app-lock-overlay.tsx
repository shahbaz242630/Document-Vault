import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { AppState } from "react-native";
import * as ExpoLocalAuthentication from "expo-local-authentication";
import * as ExpoSecureStore from "expo-secure-store";

import { type SupabaseVaultClient, useVaultSession } from "@/features/vault";
import { createSupabaseClient } from "@/shared/api/supabase-client";

import { shouldLockAfterBackground } from "../app-lock-service";
import { defaultAuditLog } from "../audit-log";
import { createBiometricAuthService } from "../biometric-auth-service";
import { createBiometricStorage } from "../biometric-storage";
import { configureDurableAuditLog } from "../durable-audit-log";
import type { SupabaseAuditClient } from "../supabase-audit-event-repository";
import { LockScreen } from "./lock-screen";
import { PrivacyScreen } from "./privacy-screen";

type AppLockOverlayProps = {
  children: ReactNode;
};

export function AppLockOverlay({ children }: AppLockOverlayProps) {
  const { isLocked, lock, initialize } = useVaultSession();
  const router = useRouter();
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        backgroundedAtRef.current = Date.now();
        setPrivacyVisible(true);
      } else if (nextAppState === "active") {
        const backgroundedAt = backgroundedAtRef.current;

        if (backgroundedAt !== null) {
          const shouldLock = shouldLockAfterBackground(backgroundedAt, Date.now());

          if (shouldLock) {
            lock();
          }
        }

        backgroundedAtRef.current = null;
        setPrivacyVisible(false);
      }
    });

    return () => subscription.remove();
  }, [lock]);

  const handleUnlock = useCallback(async () => {
    setLockError(null);
    const auth = createBiometricAuthService(ExpoLocalAuthentication);
    const storage = createBiometricStorage(ExpoSecureStore);
    const result = await auth.authenticate();

    if (result.status === "success") {
      const key = await storage.getKey();

      if (key) {
        const supabaseClient = createSupabaseClient();
        configureDurableAuditLog({
          auditLog: defaultAuditLog,
          client: supabaseClient as unknown as SupabaseAuditClient,
        });
        await initialize(key, supabaseClient as unknown as SupabaseVaultClient);
        router.replace("/vault");
      } else {
        setLockError("No cached key found. Please sign in again.");
      }
    } else if (result.status === "error") {
      setLockError(result.message ?? "Authentication failed.");
    } else {
      setLockError("Unlock was cancelled.");
    }
  }, [initialize, router]);

  return (
    <>
      {children}
      {privacyVisible ? <PrivacyScreen /> : null}
      {isLocked ? (
        <LockScreen
          error={lockError ?? undefined}
          onUnlock={handleUnlock}
        />
      ) : null}
    </>
  );
}
