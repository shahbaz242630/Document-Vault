import { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import { ErrorText, Padlock } from "@/shared/ui";

type LockScreenProps = {
  error?: string;
  onUnlock: () => void;
};

/**
 * Full-screen app lock. Tapping unlock lifts the padlock's shackle before
 * handing off to the real unlock (which may show a biometric prompt); an
 * error settles the shackle shut again.
 */
export function LockScreen({ error, onUnlock }: LockScreenProps) {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [fadeIn] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeIn, {
      duration: 300,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [fadeIn]);

  const [lastError, setLastError] = useState(error);
  if (error !== lastError) {
    setLastError(error);
    if (error) {
      setIsUnlocking(false);
    }
  }

  return (
    <Animated.View
      style={{
        alignItems: "center",
        backgroundColor: colors.background,
        bottom: 0,
        gap: 28,
        justifyContent: "center",
        left: 0,
        opacity: fadeIn,
        paddingHorizontal: 32,
        position: "absolute",
        right: 0,
        top: 0,
        zIndex: 9999,
      }}
    >
      <Padlock state={isUnlocking ? "unlocking" : "locked"} />

      <View style={{ alignItems: "center", gap: 8 }}>
        <Text
          style={{
            color: colors.ink,
            fontFamily: fonts.serif.medium,
            fontSize: 26,
          }}
        >
          Sanduqkin is locked
        </Text>
        <Text
          style={{
            color: colors.inkSecondary,
            fontFamily: fonts.sans.regular,
            fontSize: 15,
            textAlign: "center",
          }}
        >
          Your vault sealed itself when you left.
        </Text>
      </View>

      {error ? <ErrorText style={{ textAlign: "center" }}>{error}</ErrorText> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (isUnlocking) {
            return;
          }
          setIsUnlocking(true);
          setTimeout(onUnlock, 300);
        }}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.actionPressed : colors.action,
          borderCurve: "continuous",
          borderRadius: 10,
          paddingHorizontal: 28,
          paddingVertical: 14,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <Text
          style={{
            color: colors.actionText,
            fontFamily: fonts.sans.semibold,
            fontSize: 16,
          }}
        >
          Unlock
        </Text>
      </Pressable>
    </Animated.View>
  );
}
