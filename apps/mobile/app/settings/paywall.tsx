import { Stack } from "expo-router/stack";
import { lazy, Suspense } from "react";
import { View } from "react-native";

const PaywallPanel = lazy(() =>
  import("@/features/payments/components/paywall-panel").then((m) => ({
    default: m.PaywallPanel,
  })),
);

export default function PaywallRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1 }}>
        <Suspense fallback={null}>
          <PaywallPanel />
        </Suspense>
      </View>
    </>
  );
}
