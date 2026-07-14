import { forwardRef } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  /** Renders the dimmed "not yet ready" state; presses are ignored. */
  disabled?: boolean;
  style?: ViewStyle;
};

/**
 * Solid green primary action. Pressing darkens the green and scales the
 * button down slightly, matching the design's pressed state.
 */
export const PrimaryButton = forwardRef<View, ButtonProps>(
  function PrimaryButton({ label, onPress, disabled, style }, ref) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled === true }}
        disabled={disabled}
        onPress={onPress}
        ref={ref}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: disabled
            ? colors.actionDisabled
            : pressed
              ? colors.actionPressed
              : colors.action,
          borderCurve: "continuous",
          borderRadius: 10,
          paddingHorizontal: 18,
          paddingVertical: 16,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
          ...style,
        })}
      >
        <Text
          style={{
            color: colors.actionText,
            fontFamily: fonts.sans.semibold,
            fontSize: 17,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  },
);

/** Green-bordered secondary action (e.g. "Edit", "Regenerate code"). */
export function OutlineButton({ label, onPress, disabled, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? colors.successSurface : "transparent",
        borderColor: colors.action,
        borderCurve: "continuous",
        borderRadius: 10,
        borderWidth: 1.5,
        paddingHorizontal: 18,
        paddingVertical: 14,
        ...style,
      })}
    >
      <Text
        style={{
          color: colors.action,
          fontFamily: fonts.sans.semibold,
          fontSize: 16,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Plain green text action, e.g. "I already have an account". */
export function TextButton({
  label,
  onPress,
  color = colors.action,
  style,
}: ButtonProps & { color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        opacity: pressed ? 0.6 : 1,
        paddingVertical: 6,
        ...style,
      })}
    >
      <Text
        style={{
          color,
          fontFamily: fonts.sans.regular,
          fontSize: 15,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Small pill button, e.g. vault header "Settings" / "Lock". */
export function PillButton({ label, onPress, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        borderColor: pressed ? colors.action : colors.border,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 8,
        ...style,
      })}
    >
      <Text
        style={{
          color: colors.action,
          fontFamily: fonts.sans.semibold,
          fontSize: 13.5,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
