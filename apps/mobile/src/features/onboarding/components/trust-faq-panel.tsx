import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Animated, Easing, PanResponder, Text, View } from "react-native";

import { copy } from "@/shared/i18n/en";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  GoldHairline,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
} from "@/shared/ui";

const questions = copy.trustFaq;
const swipeDistanceThreshold = 48;
const swipeVelocityThreshold = 0.35;

/**
 * The pre-signup trust carousel: one question per view, gold pagination
 * dots, and each question sliding in from the right.
 */
export function TrustFaqPanel() {
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const [slide] = useState(() => new Animated.Value(0));
  const isLast = index === questions.length - 1;
  const current = questions[index];
  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          const swipedLeft =
            gesture.dx < -swipeDistanceThreshold ||
            gesture.vx < -swipeVelocityThreshold;
          const swipedRight =
            gesture.dx > swipeDistanceThreshold ||
            gesture.vx > swipeVelocityThreshold;

          if (swipedLeft && index < questions.length - 1) {
            setIndex(index + 1);
          } else if (swipedRight && index > 0) {
            setIndex(index - 1);
          }
        },
      }),
    [index],
  );

  useEffect(() => {
    slide.setValue(18);
    Animated.timing(slide, {
      duration: 400,
      easing: Easing.out(Easing.ease),
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [index, slide]);

  return (
    <View style={{ flex: 1, gap: 20 }}>
      <ScreenHeader
        eyebrow={`Question ${index + 1} of ${questions.length}`}
        onBack={() => {
          if (index === 0) {
            router.back();
          } else {
            setIndex(index - 1);
          }
        }}
      />

      <Animated.View
        {...swipeResponder.panHandlers}
        style={{
          flex: 1,
          gap: 20,
          justifyContent: "center",
          opacity: slide.interpolate({
            inputRange: [0, 18],
            outputRange: [1, 0],
          }),
          transform: [{ translateX: slide }],
        }}
      >
        <SerifTitle size={31}>{current.question}</SerifTitle>
        <GoldHairline />
        <Text
          style={{
            color: colors.inkSoft,
            fontFamily: fonts.sans.regular,
            fontSize: 16.5,
            lineHeight: 26,
          }}
        >
          {current.answer}
        </Text>
      </Animated.View>

      <View style={{ gap: 20 }}>
        <PaginationDots activeIndex={index} count={questions.length} />
        <PrimaryButton
          label={isLast ? "I'm ready — create my vault" : "Next question"}
          onPress={() => {
            if (isLast) {
              router.push("/auth/sign-up");
            } else {
              setIndex(index + 1);
            }
          }}
        />
      </View>
    </View>
  );
}

function PaginationDots({
  activeIndex,
  count,
}: {
  activeIndex: number;
  count: number;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
      }}
    >
      {Array.from({ length: count }, (_, dotIndex) => (
        <View
          key={dotIndex}
          style={{
            backgroundColor:
              dotIndex === activeIndex ? colors.action : colors.border,
            borderRadius: 3,
            height: 6,
            width: dotIndex === activeIndex ? 20 : 6,
          }}
        />
      ))}
    </View>
  );
}
