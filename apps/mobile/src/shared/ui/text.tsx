import type { ReactNode } from "react";
import { Text, type TextStyle } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";

type TextChildrenProps = {
  children: ReactNode;
  style?: TextStyle;
};

/** Gold serif kicker, e.g. "Account · Step 1 of 3" or "Sanduqkin Premium". */
export function Eyebrow({ children, style }: TextChildrenProps) {
  return (
    <Text
      style={{
        color: colors.gold,
        fontFamily: fonts.serif.regular,
        fontSize: 15,
        letterSpacing: 1,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** Large serif screen heading. */
export function SerifTitle({
  children,
  size = 30,
  style,
}: TextChildrenProps & { size?: number }) {
  return (
    <Text
      style={{
        color: colors.ink,
        fontFamily: fonts.serif.medium,
        fontSize: size,
        lineHeight: Math.round(size * 1.16),
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** Supporting copy under a heading. */
export function Subtitle({ children, style }: TextChildrenProps) {
  return (
    <Text
      style={{
        color: colors.inkSecondary,
        fontFamily: fonts.sans.regular,
        fontSize: 15.5,
        lineHeight: 24,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** Standard body text. */
export function BodyText({ children, style }: TextChildrenProps) {
  return (
    <Text
      style={{
        color: colors.inkSoft,
        fontFamily: fonts.sans.regular,
        fontSize: 15.5,
        lineHeight: 23,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** Deemphasized captions and hints. */
export function MutedText({ children, style }: TextChildrenProps) {
  return (
    <Text
      style={{
        color: colors.inkMuted,
        fontFamily: fonts.sans.regular,
        fontSize: 13.5,
        lineHeight: 20,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** Inline form / action error. */
export function ErrorText({ children, style }: TextChildrenProps) {
  return (
    <Text
      style={{
        color: colors.danger,
        fontFamily: fonts.sans.regular,
        fontSize: 14,
        lineHeight: 21,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** Field label above an input. */
export function FieldLabel({ children, style }: TextChildrenProps) {
  return (
    <Text
      style={{
        color: colors.ink,
        fontFamily: fonts.sans.semibold,
        fontSize: 14,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** Uppercase gold section label used in Settings-style grouped lists. */
export function SectionLabel({ children, style }: TextChildrenProps) {
  return (
    <Text
      style={{
        color: colors.gold,
        fontFamily: fonts.sans.semibold,
        fontSize: 11.5,
        letterSpacing: 1.3,
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </Text>
  );
}
