import { Stack } from "expo-router/stack";
import { lazy, Suspense } from "react";
import { View } from "react-native";

const CustomerCenterPanel = lazy(() =>
  import("@/features/payments/components/customer-center-panel").then((m) => ({
    default: m.CustomerCenterPanel,
  })),
);

export default function CustomerCenterRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Manage subscription" }} />
      <View style={{ flex: 1 }}>
        <Suspense fallback={null}>
          <CustomerCenterPanel />
        </Suspense>
      </View>
    </>
  );
}
