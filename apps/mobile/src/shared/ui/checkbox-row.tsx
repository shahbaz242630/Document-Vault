import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";

/** Tappable checkbox row, e.g. "I've saved these somewhere safe". */
export function CheckboxRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 12,
        paddingVertical: 4,
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: checked ? colors.action : "transparent",
          borderColor: checked ? colors.action : colors.inkMuted,
          borderCurve: "continuous",
          borderRadius: 6,
          borderWidth: 1.5,
          height: 22,
          justifyContent: "center",
          width: 22,
        }}
      >
        {checked ? (
          <Text
            style={{
              color: colors.actionText,
              fontFamily: fonts.sans.bold,
              fontSize: 13,
              lineHeight: 15,
            }}
          >
            ✓
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          color: colors.inkSoft,
          flexShrink: 1,
          fontFamily: fonts.sans.regular,
          fontSize: 15,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
