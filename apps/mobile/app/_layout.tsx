import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import Purchases from "react-native-purchases";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";

import { AppLockOverlay, RecoveryPhraseSessionProvider } from "@/features/auth";
import { VaultSessionProvider } from "@/features/vault";
import { initializeSslPinningIfAvailable } from "@/shared/security/ssl-pinning";
import { colors } from "@/shared/theme/colors";
import { getRevenueCatEnv } from "@/shared/config/revenuecat-env";

export default function RootLayout() {
  useEffect(() => {
    // Initialize SSL pinning as early as possible, before any network
    // requests. This is a no-op in Expo Go (native module unavailable).
    void initializeSslPinningIfAvailable();

    const env = getRevenueCatEnv(
      typeof process !== "undefined" && process.env ? process.env : {},
    );

    if (env.isConfigured) {
      const apiKey = Platform.OS === "ios" ? env.iosKey : env.androidKey;
      Purchases.configure({ apiKey });
    }

    async function sync() {
      try {
        await Purchases.syncPurchases();
      } catch {
        // Ignore — Purchases may not be configured or the device may be offline.
      }
    }

    // Sync on mount in case purchases completed while the app was backgrounded.
    void sync();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        void sync();
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <VaultSessionProvider>
      <RecoveryPhraseSessionProvider>
        <AppLockOverlay>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: colors.background },
              headerShadowVisible: false,
            }}
          />
        </AppLockOverlay>
      </RecoveryPhraseSessionProvider>
    </VaultSessionProvider>
  );
}
