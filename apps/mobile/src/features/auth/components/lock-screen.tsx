import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

type LockScreenProps = {
  error?: string;
  onUnlock: () => void;
};

export function LockScreen({ error, onUnlock }: LockScreenProps) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.ink,
        bottom: 0,
        justifyContent: "center",
        left: 0,
        paddingHorizontal: 24,
        position: "absolute",
        right: 0,
        top: 0,
        zIndex: 9999,
      }}
    >
      <Text
        style={{
          color: colors.background,
          fontSize: 30,
          fontWeight: "700",
        }}
      >
        Sanduqkin is locked
      </Text>
      <Text
        style={{
          color: colors.inkMuted,
          fontSize: 17,
          lineHeight: 25,
          marginTop: 12,
          textAlign: "center",
        }}
      >
        Unlock to continue. For your security, Sanduqkin locks automatically after a period of inactivity.
      </Text>

      {error ? (
        <Text
          selectable
          style={{
            color: colors.danger,
            fontSize: 15,
            lineHeight: 22,
            marginTop: 16,
            textAlign: "center",
          }}
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onUnlock}
        style={{
          alignItems: "center",
          backgroundColor: colors.action,
          borderCurve: "continuous",
          borderRadius: 8,
          marginTop: 32,
          paddingHorizontal: 18,
          paddingVertical: 14,
          width: "100%",
        }}
      >
        <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
          Unlock
        </Text>
      </Pressable>
    </View>
  );
}
