import { Pressable, Text } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";

/** Selectable pill chip, e.g. the approximate-value ranges on asset forms. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        backgroundColor: selected ? colors.successSurface : colors.surface,
        borderColor: selected ? colors.action : colors.border,
        borderRadius: 999,
        borderWidth: 1.5,
        paddingHorizontal: 13,
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          color: selected ? colors.action : colors.inkSoft,
          fontFamily: fonts.sans.regular,
          fontSize: 13.5,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
