import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { AppState } from "react-native";
import * as ExpoSecureStore from "expo-secure-store";

import type { SupabaseVaultClient } from "@/features/vault/supabase-vault-repository";
import { useVaultSession } from "@/features/vault/vault-session-context";
import { createSupabaseClient } from "@/shared/api/supabase-client";

import {
  createAppLockService,
  shouldLockAfterBackground,
} from "../app-lock-service";
import { defaultAuditLog } from "../audit-log";
import { createBiometricStorage } from "../biometric-storage";
import { configureDurableAuditLog } from "../durable-audit-log";
import type { SupabaseAuditClient } from "../supabase-audit-event-repository";
import { LockScreen } from "./lock-screen";
import { PrivacyScreen } from "./privacy-screen";

type AppLockOverlayProps = {
  children: ReactNode;
};

export function AppLockOverlay({ children }: AppLockOverlayProps) {
  const { isLocked, lock, initialize, signOut } = useVaultSession();
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

    try {
      const result = await createAppLockService({
        biometricStorage: createBiometricStorage(ExpoSecureStore),
      }).unlock();

      if (!result.success) {
        setLockError(result.reason);
        return;
      }

      const supabaseClient = createSupabaseClient();
      if (!supabaseClient) {
        setLockError("Sanduqkin could not connect. Check your connection or use your password.");
        return;
      }

      const { data, error } = await supabaseClient.auth.getSession();
      if (error || !data.session) {
        setLockError("Your sign-in session expired. Use your password to sign in again.");
        return;
      }

      configureDurableAuditLog({
        auditLog: defaultAuditLog,
        client: supabaseClient as unknown as SupabaseAuditClient,
      });
      await initialize(result.key, supabaseClient as unknown as SupabaseVaultClient);
      router.replace("/vault");
    } catch {
      setLockError("Authentication failed. Try again or use your password.");
    }
  }, [initialize, router]);

  const handleUsePassword = useCallback(() => {
    setLockError(null);
    signOut();
    router.replace("/auth/sign-in");
  }, [router, signOut]);

  return (
    <>
      {children}
      {privacyVisible ? <PrivacyScreen /> : null}
      {isLocked ? (
        <LockScreen
          error={lockError ?? undefined}
          onUsePassword={handleUsePassword}
          onUnlock={handleUnlock}
        />
      ) : null}
    </>
  );
}
