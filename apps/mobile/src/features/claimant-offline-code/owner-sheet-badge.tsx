import { Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";

import type { OwnerSheetBadge } from "./owner-sheet-status";

const tones = {
  active: { background: colors.successSurface, border: colors.successBorder, ink: colors.action },
  revoked: { background: colors.dangerSurface, border: colors.dangerBorder, ink: colors.danger },
  expired: { background: colors.divider, border: colors.border, ink: colors.inkMuted },
} as const;

/** Active is green; revoked is red and expired grey, so neither can be mistaken for a usable sheet. */
export function OwnerSheetBadgeView({ badge }: { badge: OwnerSheetBadge }) {
  const tone = tones[badge.tone];
  return (
    <View style={{ backgroundColor: tone.background, borderColor: tone.border, borderRadius: 999, borderWidth: 1,
      paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: tone.ink, fontFamily: fonts.sans.semibold, fontSize: 12 }}>{badge.label}</Text>
    </View>
  );
}
