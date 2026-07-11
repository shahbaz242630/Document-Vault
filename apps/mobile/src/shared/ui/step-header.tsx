import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";

/**
 * The nine onboarding steps and their progress-bar fill, matching the design:
 * Account 1-3, Security 1-3, Recovery 1-3.
 */
export const onboardingSteps = {
  "account-1": { label: "Account · Step 1 of 3", fill: 11 },
  "account-2": { label: "Account · Step 2 of 3", fill: 22 },
  "account-3": { label: "Account · Step 3 of 3", fill: 33 },
  "security-1": { label: "Security · Step 1 of 3", fill: 44 },
  "security-2": { label: "Security · Step 2 of 3", fill: 55 },
  "security-3": { label: "Security · Step 3 of 3", fill: 66 },
  "recovery-1": { label: "Recovery · Step 1 of 3", fill: 77 },
  "recovery-2": { label: "Recovery · Step 2 of 3", fill: 88 },
  "recovery-3": { label: "Recovery · Step 3 of 3", fill: 96 },
} as const;

export type OnboardingStep = keyof typeof onboardingSteps;

const stepOrder = Object.keys(onboardingSteps) as OnboardingStep[];

/** Round gold-serif back chevron used at the top of nearly every screen. */
export function BackChevron({ onPress }: { onPress?: () => void }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel="Back"
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress ?? (() => router.back())}
      style={({ pressed }) => ({
        opacity: pressed ? 0.5 : 1,
        width: 32,
      })}
    >
      <Text
        style={{
          color: colors.inkMuted,
          fontFamily: fonts.sans.regular,
          fontSize: 24,
          lineHeight: 26,
        }}
      >
        ‹
      </Text>
    </Pressable>
  );
}

/**
 * Onboarding step header: back chevron, gold serif step label, and the thin
 * gold progress bar that animates in from the previous step's fill.
 */
export function StepHeader({
  step,
  onBack,
}: {
  step: OnboardingStep;
  onBack?: () => void;
}) {
  const { label, fill } = onboardingSteps[step];
  const stepIndex = stepOrder.indexOf(step);
  const previousFill =
    stepIndex > 0 ? onboardingSteps[stepOrder[stepIndex - 1]].fill : 0;
  const [progress] = useState(() => new Animated.Value(previousFill));

  useEffect(() => {
    Animated.timing(progress, {
      duration: 600,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      toValue: fill,
      useNativeDriver: false,
    }).start();
  }, [fill, progress]);

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <BackChevron onPress={onBack} />
        <Text
          style={{
            color: colors.gold,
            fontFamily: fonts.serif.regular,
            fontSize: 15,
            letterSpacing: 0.9,
          }}
        >
          {label}
        </Text>
        <View style={{ width: 32 }} />
      </View>
      <View
        style={{
          backgroundColor: colors.track,
          borderRadius: 1,
          height: 2,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            backgroundColor: colors.gold,
            borderRadius: 1,
            height: 2,
            width: progress.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
          }}
        />
      </View>
    </View>
  );
}

/**
 * Plain screen header for screens without onboarding progress: just the back
 * chevron, optionally with a centered gold serif eyebrow.
 */
export function ScreenHeader({
  eyebrow,
  onBack,
}: {
  eyebrow?: string;
  onBack?: () => void;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <BackChevron onPress={onBack} />
      {eyebrow ? (
        <Text
          style={{
            color: colors.gold,
            fontFamily: fonts.serif.regular,
            fontSize: 15,
            letterSpacing: 0.9,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <View style={{ width: 32 }} />
    </View>
  );
}
