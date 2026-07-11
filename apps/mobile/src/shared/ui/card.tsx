import type { ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";

/** Cream card surface with the standard border and radius. */
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 14,
        borderWidth: 1,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </View>
  );
}

/** Dashed-border empty state, e.g. "Nothing here yet". */
export function EmptyStateCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 14,
        borderStyle: "dashed",
        borderWidth: 1,
        gap: 8,
        paddingHorizontal: 22,
        paddingVertical: 28,
      }}
    >
      <Text
        style={{
          color: colors.ink,
          fontFamily: fonts.serif.regular,
          fontSize: 19,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.inkMuted,
          fontFamily: fonts.sans.regular,
          fontSize: 14,
          lineHeight: 21,
          textAlign: "center",
        }}
      >
        {description}
      </Text>
    </View>
  );
}

type ListRowProps = {
  title: string;
  /** Secondary line under the title. */
  subtitle?: string;
  /** Trailing value shown before the chevron (Settings-style rows). */
  value?: string;
  /** Renders the subtitle in mono (e.g. "Barclays ····1234"). */
  monoSubtitle?: boolean;
  titleColor?: string;
  onPress?: () => void;
  /** Hides the gold chevron for non-navigating rows. */
  showChevron?: boolean;
  isLast?: boolean;
};

/** A tappable row inside a Card list, with divider and gold chevron. */
export function ListRow({
  title,
  subtitle,
  value,
  monoSubtitle,
  titleColor = colors.ink,
  onPress,
  showChevron = true,
  isLast = false,
}: ListRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? colors.background : "transparent",
        borderBottomColor: colors.divider,
        borderBottomWidth: isLast ? 0 : 1,
        flexDirection: "row",
        gap: 12,
        justifyContent: "space-between",
        paddingHorizontal: 18,
        paddingVertical: subtitle ? 15 : 16,
      })}
    >
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Text
          style={{
            color: titleColor,
            fontFamily: fonts.sans.medium,
            fontSize: 16,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              color: colors.inkMuted,
              fontFamily: monoSubtitle ? fonts.mono.regular : fonts.sans.regular,
              fontSize: 13,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        {value ? (
          <Text
            style={{
              color: colors.inkMuted,
              fontFamily: fonts.sans.regular,
              fontSize: 13,
            }}
          >
            {value}
          </Text>
        ) : null}
        {showChevron ? <Chevron /> : null}
      </View>
    </Pressable>
  );
}

/** Gold "›" list chevron. */
export function Chevron() {
  return (
    <Text
      style={{
        color: colors.gold,
        fontFamily: fonts.sans.regular,
        fontSize: 18,
        lineHeight: 20,
      }}
    >
      ›
    </Text>
  );
}

type NoticeVariant = "success" | "danger";

const noticeColors: Record<
  NoticeVariant,
  { background: string; border: string; body: string; title: string }
> = {
  success: {
    background: colors.successSurface,
    border: colors.successBorder,
    body: colors.inkSoft,
    title: colors.action,
  },
  danger: {
    background: colors.dangerSurface,
    border: colors.dangerBorder,
    body: colors.dangerInk,
    title: colors.danger,
  },
};

/** Tinted notice box, e.g. "Link sent" or "Too many attempts". */
export function NoticeBox({
  variant,
  title,
  children,
}: {
  variant: NoticeVariant;
  title: string;
  children?: ReactNode;
}) {
  const palette = noticeColors[variant];

  return (
    <View
      style={{
        backgroundColor: palette.background,
        borderColor: palette.border,
        borderCurve: "continuous",
        borderRadius: 10,
        borderWidth: 1,
        gap: 6,
        padding: 15,
      }}
    >
      <Text
        style={{
          color: palette.title,
          fontFamily: fonts.sans.semibold,
          fontSize: 14.5,
        }}
      >
        {title}
      </Text>
      {children ? (
        <Text
          style={{
            color: palette.body,
            fontFamily: fonts.sans.regular,
            fontSize: 13.5,
            lineHeight: 20,
          }}
        >
          {children}
        </Text>
      ) : null}
    </View>
  );
}
