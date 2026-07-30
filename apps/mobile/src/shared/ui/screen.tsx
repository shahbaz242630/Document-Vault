import { useEffect, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/shared/theme/colors";

/**
 * Kept for legacy call sites; new screens should use <Screen> which adds
 * safe-area padding and the design's entrance animation.
 */
export const screenStyles = {
  content: {
    flexGrow: 1,
    gap: 24,
    justifyContent: "center",
    padding: 28,
  },
  formContent: {
    flexGrow: 1,
    gap: 24,
    justifyContent: "flex-start",
    padding: 28,
    paddingBottom: 72,
  },
} as const;

/**
 * Standard screen scaffold: cream background, design padding (28px sides,
 * safe-area-aware top, 44px bottom), scrolling content, and the subtle
 * fade-up entrance every screen in the design uses.
 */
export function Screen({
  children,
  justify = "flex-start",
  gap = 22,
  animateIn = true,
  contentStyle,
  fixedBottom,
}: {
  children: ReactNode;
  justify?: ViewStyle["justifyContent"];
  gap?: number;
  animateIn?: boolean;
  contentStyle?: ViewStyle;
  fixedBottom?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(animateIn ? 0 : 1));
  const [translateY] = useState(() => new Animated.Value(animateIn ? 10 : 0));

  useEffect(() => {
    if (!animateIn) {
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        duration: 350,
        easing: Easing.out(Easing.ease),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: 350,
        easing: Easing.out(Easing.ease),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animateIn, opacity, translateY]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ backgroundColor: colors.background, flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: fixedBottom ? 24 : Math.max(insets.bottom, 24) + 20,
          paddingHorizontal: 28,
          paddingTop: insets.top + 20,
        }}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        <Animated.View
          style={{
            flexGrow: 1,
            gap,
            justifyContent: justify,
            opacity,
            transform: [{ translateY }],
            ...contentStyle,
          }}
        >
          {children}
        </Animated.View>
      </ScrollView>
      {fixedBottom ? (
        <View
          style={{
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, 12),
            paddingHorizontal: 28,
          }}
        >
          {fixedBottom}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
