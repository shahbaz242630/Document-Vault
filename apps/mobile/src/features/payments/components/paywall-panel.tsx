import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";

import { colors } from "@/shared/theme/colors";
import { getRevenueCatEnv } from "@/shared/config/revenuecat-env";
import { REVENUECAT_ENTITLEMENT_ID } from "../revenuecat-config";

export function PaywallPanel() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const env = getRevenueCatEnv(
    typeof process !== "undefined" && process.env ? process.env : {},
  );

  useEffect(() => {
    let isMounted = true;

    async function presentPaywall() {
      if (!env.isConfigured) return;

      try {
        await RevenueCatUI.presentPaywallIfNeeded({
          displayCloseButton: true,
          requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_ID,
        });
        if (isMounted) router.back();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "The paywall could not be opened.";
        if (isMounted) setError(message);
      }
    }

    void presentPaywall();

    return () => {
      isMounted = false;
    };
  }, [env.isConfigured, router]);

  if (!env.isConfigured) {
    return (
      <View
        style={{
          alignItems: "center",
          flex: 1,
          gap: 12,
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "700" }}>
          Premium
        </Text>
        <Text
          style={{
            color: colors.inkMuted,
            fontSize: 15,
            textAlign: "center",
          }}
        >
          In-app purchases are not yet configured. Add the RevenueCat public API
          key to the app environment before testing subscriptions.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        alignItems: "center",
        flex: 1,
        gap: 16,
        justifyContent: "center",
        padding: 24,
      }}
    >
      {error ? (
        <>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "700" }}>
            Paywall unavailable
          </Text>
          <Text
            style={{
              color: colors.inkMuted,
              fontSize: 15,
              textAlign: "center",
            }}
          >
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={{
              backgroundColor: colors.ink,
              borderRadius: 8,
              paddingHorizontal: 18,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: colors.actionText, fontWeight: "700" }}>
              Close
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.ink} />
          <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
            Opening subscription options...
          </Text>
        </>
      )}
    </View>
  );
}
