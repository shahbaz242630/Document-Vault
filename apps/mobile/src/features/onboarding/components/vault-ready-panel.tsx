import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

export function VaultReadyPanel() {
  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 10 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
          All set
        </Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: 34,
            fontWeight: "700",
            lineHeight: 40,
          }}
        >
          Welcome to Sanduqkin
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          {"You're set up. Let's add your first piece of information."}
        </Text>
      </View>

      <Link href="/vault" asChild>
        <Pressable
          accessibilityRole="button"
          style={{
            alignItems: "center",
            backgroundColor: colors.action,
            borderCurve: "continuous",
            borderRadius: 8,
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}
        >
          <Text
            style={{
              color: colors.actionText,
              fontSize: 17,
              fontWeight: "700",
            }}
          >
            Go to vault
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
