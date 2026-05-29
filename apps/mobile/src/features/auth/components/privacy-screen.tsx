import { Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

export function PrivacyScreen() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.background,
        bottom: 0,
        justifyContent: "center",
        left: 0,
        position: "absolute",
        right: 0,
        top: 0,
        zIndex: 9998,
      }}
    >
      <Text
        style={{
          color: colors.ink,
          fontSize: 30,
          fontWeight: "700",
        }}
      >
        Sanduqkin
      </Text>
      <Text style={{ color: colors.inkMuted, fontSize: 15, marginTop: 8 }}>
        Secure info organizer
      </Text>
    </View>
  );
}
