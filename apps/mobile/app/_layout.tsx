import "@/shared/runtime/buffer-polyfill";
import "@/shared/crypto/secure-random-polyfill-expo";

import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import Purchases from "react-native-purchases";
import {
  AlbertSans_400Regular,
  AlbertSans_500Medium,
  AlbertSans_600SemiBold,
  AlbertSans_700Bold,
} from "@expo-google-fonts/albert-sans";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from "@expo-google-fonts/ibm-plex-mono";
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
} from "@expo-google-fonts/newsreader";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
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

void SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash screen may already be hidden (e.g. during fast refresh).
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    AlbertSans_400Regular,
    AlbertSans_500Medium,
    AlbertSans_600SemiBold,
    AlbertSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => {
        // Hiding twice is harmless.
      });
    }
  }, [fontsLoaded, fontError]);

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

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <VaultSessionProvider>
      <RecoveryPhraseSessionProvider>
        <AppLockOverlay>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: colors.background },
              headerShown: false,
            }}
          />
        </AppLockOverlay>
      </RecoveryPhraseSessionProvider>
    </VaultSessionProvider>
  );
}
