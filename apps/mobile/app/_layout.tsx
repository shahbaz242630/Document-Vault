import "@/shared/crypto/secure-random-polyfill-expo";

import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import Purchases from "react-native-purchases";
import Constants from "expo-constants";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";

import { AppLockOverlay, RecoveryPhraseSessionProvider } from "@/features/auth";
import { VaultSessionProvider } from "@/features/vault";
import { initializeSslPinningIfAvailable } from "@/shared/security/ssl-pinning";
import { colors } from "@/shared/theme/colors";
import {
  getRevenueCatEnv,
  selectRevenueCatApiKey,
} from "@/shared/config/revenuecat-env";
import { shouldUseRevenueCatNativeBridge } from "@/shared/config/revenuecat-runtime";

export default function RootLayout() {
  useEffect(() => {
    // Initialize SSL pinning as early as possible, before any network
    // requests. This is a no-op in Expo Go (native module unavailable).
    void initializeSslPinningIfAvailable();

    const env = getRevenueCatEnv(
      typeof process !== "undefined" && process.env ? process.env : {},
    );

    const apiKey = selectRevenueCatApiKey(env, Platform.OS);

    const canUseRevenueCat = shouldUseRevenueCatNativeBridge({
      appOwnership: Constants.appOwnership,
      platform: Platform.OS,
    });

    if (!canUseRevenueCat) {
      return;
    }

    if (apiKey) {
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
