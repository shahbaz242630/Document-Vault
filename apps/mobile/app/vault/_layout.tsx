import { Stack } from "expo-router/stack";

import { colors } from "@/shared/theme/colors";

export default function VaultLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}
    />
  );
}
