import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";

import { colors } from "@/shared/theme/colors";
import { getRevenueCatEnv } from "@/shared/config/revenuecat-env";

export function PaywallPanel() {
  const router = useRouter();
  const env = getRevenueCatEnv(
    typeof process !== "undefined" && process.env ? process.env : {},
  );

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
          In-app purchases are not yet configured. Check back after the founder
          completes RevenueCat dashboard setup.
        </Text>
      </View>
    );
  }

  return (
    <RevenueCatUI.Paywall
      options={{ displayCloseButton: true }}
      onDismiss={() => {
        router.back();
      }}
      onPurchaseCancelled={() => {
        router.back();
      }}
      onPurchaseCompleted={() => {
        router.back();
      }}
    />
  );
}
