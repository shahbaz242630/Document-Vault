import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";

import { colors } from "@/shared/theme/colors";

/**
 * The signature 44px gold hairline. With `animated` it draws itself in from
 * zero width after `delayMs`, as on the "All set" and "Reset done" screens.
 */
export function GoldHairline({
  animated = false,
  delayMs = 0,
  width = 44,
}: {
  animated?: boolean;
  delayMs?: number;
  width?: number;
}) {
  const [drawn] = useState(() => new Animated.Value(animated ? 0 : width));

  useEffect(() => {
    if (!animated) {
      return;
    }
    Animated.timing(drawn, {
      delay: delayMs,
      duration: 800,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      toValue: width,
      useNativeDriver: false,
    }).start();
  }, [animated, delayMs, drawn, width]);

  return (
    <Animated.View
      style={{ backgroundColor: colors.gold, height: 1, width: drawn }}
    />
  );
}
