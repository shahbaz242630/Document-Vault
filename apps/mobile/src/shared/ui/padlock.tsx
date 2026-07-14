import { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { colors } from "@/shared/theme/colors";

type PadlockProps = {
  /**
   * - "sealing": plays the seal-shut entrance (body pops in, shackle drops).
   * - "locked": resting closed state with a gentle settle on mount.
   * - "unlocking": shackle lifts and tilts open.
   */
  state: "sealing" | "locked" | "unlocking";
  /** Overall scale; 1 is the app-lock size (64×74). */
  size?: "small" | "large";
};

/**
 * The Sanduqkin padlock: green body with keyhole, gold shackle. The shackle
 * animates shut when a vault is sealed and lifts open while unlocking.
 */
export function Padlock({ state, size = "large" }: PadlockProps) {
  const isSmall = size === "small";
  const dimensions = getPadlockDimensions(isSmall);
  const animation = usePadlockAnimation(state);

  return (
    <View style={{ height: dimensions.totalHeight, width: dimensions.totalWidth }}>
      <Animated.View
        style={{
          borderColor: colors.gold,
          borderBottomWidth: 0,
          borderTopLeftRadius: dimensions.shackleSize * 0.58,
          borderTopRightRadius: dimensions.shackleSize * 0.58,
          borderWidth: dimensions.borderWidth,
          height: dimensions.shackleSize,
          left: (dimensions.totalWidth - dimensions.shackleSize) / 2,
          opacity: animation.shackleOpacity,
          position: "absolute",
          top: 0,
          transform: [
            { translateY: animation.shackleY },
            {
              rotate: animation.shackleTilt.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "-9deg"],
              }),
            },
          ],
          width: dimensions.shackleSize,
        }}
      />
      <PadlockBody animation={animation} dimensions={dimensions} isSmall={isSmall} />
    </View>
  );
}

function usePadlockAnimation(state: PadlockProps["state"]) {

  const [shackleY] = useState(
    () =>
      new Animated.Value(
        state === "sealing" ? -12 : state === "locked" ? -8 : 0,
      ),
  );
  const [shackleTilt] = useState(() => new Animated.Value(0));
  const [shackleOpacity] = useState(
    () =>
      new Animated.Value(
        state === "sealing" ? 0 : state === "locked" ? 0.5 : 1,
      ),
  );
  const [bodyScale] = useState(
    () => new Animated.Value(state === "sealing" ? 0.85 : 1),
  );
  const [bodyOpacity] = useState(
    () => new Animated.Value(state === "sealing" ? 0 : 1),
  );

  useEffect(() => {
    if (state === "sealing") {
      Animated.parallel([
        Animated.timing(bodyScale, {
          duration: 500,
          easing: Easing.out(Easing.ease),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(bodyOpacity, {
          duration: 500,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(450),
          Animated.parallel([
            Animated.timing(shackleOpacity, {
              duration: 360,
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.timing(shackleY, {
              duration: 600,
              easing: Easing.bezier(0.34, 1.4, 0.64, 1),
              toValue: 0,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
      return;
    }

    if (state === "locked") {
      shackleTilt.setValue(0);
      Animated.parallel([
        Animated.timing(shackleOpacity, {
          duration: 500,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(shackleY, {
          duration: 500,
          easing: Easing.out(Easing.ease),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(shackleY, {
        duration: 450,
        easing: Easing.bezier(0.34, 1.2, 0.64, 1),
        toValue: -10,
        useNativeDriver: true,
      }),
      Animated.timing(shackleTilt, {
        duration: 450,
        easing: Easing.bezier(0.34, 1.2, 0.64, 1),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bodyOpacity, bodyScale, shackleOpacity, shackleTilt, shackleY, state]);

  return { bodyOpacity, bodyScale, shackleOpacity, shackleTilt, shackleY };
}

function PadlockBody({
  animation,
  dimensions,
  isSmall,
}: {
  animation: ReturnType<typeof usePadlockAnimation>;
  dimensions: ReturnType<typeof getPadlockDimensions>;
  isSmall: boolean;
}) {
  return (
    <Animated.View
      style={{
        alignItems: "center",
        backgroundColor: colors.surface,
        borderColor: colors.action,
        borderCurve: "continuous",
        borderRadius: isSmall ? 13 : 15,
        borderWidth: dimensions.borderWidth,
        bottom: 0,
        height: dimensions.bodyHeight,
        justifyContent: "center",
        left: (dimensions.totalWidth - dimensions.bodyWidth) / 2,
        opacity: animation.bodyOpacity,
        position: "absolute",
        transform: [{ scale: animation.bodyScale }],
        width: dimensions.bodyWidth,
      }}
    >
      <View
        style={{
          borderColor: colors.action,
          borderRadius: 99,
          borderWidth: dimensions.borderWidth,
          height: isSmall ? 9 : 10,
          width: isSmall ? 9 : 10,
        }}
      />
    </Animated.View>
  );
}

function getPadlockDimensions(isSmall: boolean) {
  return {
    bodyHeight: isSmall ? 40 : 46,
    bodyWidth: isSmall ? 52 : 60,
    borderWidth: isSmall ? 2 : 2.5,
    shackleSize: isSmall ? 24 : 28,
    totalHeight: isSmall ? 64 : 74,
    totalWidth: isSmall ? 56 : 64,
  };
}
