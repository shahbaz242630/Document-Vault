import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  Card,
  MutedText,
  PrimaryButton,
  SerifTitle,
  StepHeader,
  Subtitle,
} from "@/shared/ui";

import {
  generateRecoveryPhraseAndMEK,
  type GenerateRandomBytes,
} from "../recovery-phrase-service";
import { createRecoveryPhraseViewModel } from "../recovery-phrase-view-model";

type RecoveryPhrasePanelProps = {
  generateRandomBytes: GenerateRandomBytes;
  onContinue: (session: { mek: Uint8Array; words: string[] }) => void;
};

export function RecoveryPhrasePanel({
  generateRandomBytes,
  onContinue,
}: RecoveryPhrasePanelProps) {
  const viewModel = createRecoveryPhraseViewModel();
  const [{ mek, words }] = useState(() =>
    generateRecoveryPhraseAndMEK(generateRandomBytes),
  );
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={{ flex: 1, gap: 18 }}>
      <StepHeader step="recovery-1" />

      <View style={{ gap: 10 }}>
        <SerifTitle>{viewModel.title}</SerifTitle>
        <Subtitle>{viewModel.body}</Subtitle>
      </View>

      <View>
        <Card
          style={{
            columnGap: 18,
            flexDirection: "row",
            flexWrap: "wrap",
            padding: 18,
            rowGap: 10,
          }}
        >
          {words.map((word, index) => (
            <RevealedWord
              index={index}
              key={`${index}-${word}`}
              revealed={revealed}
              word={word}
            />
          ))}
        </Card>
        {!revealed ? (
          <Pressable
            accessibilityLabel="Reveal recovery phrase"
            accessibilityRole="button"
            onPress={() => setRevealed(true)}
            style={{
              alignItems: "center",
              bottom: 0,
              justifyContent: "center",
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            }}
          >
            <View
              style={{
                backgroundColor: colors.ink,
                borderRadius: 999,
                paddingHorizontal: 18,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{
                  color: colors.actionText,
                  fontFamily: fonts.sans.semibold,
                  fontSize: 14,
                }}
              >
                Tap to reveal
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      <MutedText>{viewModel.warning}</MutedText>

      <View style={{ marginTop: "auto" }}>
        <PrimaryButton
          disabled={!revealed}
          label={viewModel.primaryActionLabel}
          onPress={() => onContinue({ mek, words })}
        />
      </View>
    </View>
  );
}

function RevealedWord({
  index,
  revealed,
  word,
}: {
  index: number;
  revealed: boolean;
  word: string;
}) {
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!revealed) {
      return;
    }
    Animated.timing(opacity, {
      delay: index * 60,
      duration: 500,
      easing: Easing.out(Easing.ease),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [index, opacity, revealed]);

  return (
    <Animated.View
      style={{
        alignItems: "baseline",
        flexBasis: "44%",
        flexDirection: "row",
        flexGrow: 1,
        gap: 10,
        opacity,
      }}
    >
      <Text
        style={{
          color: colors.gold,
          fontFamily: fonts.mono.regular,
          fontSize: 12,
          textAlign: "right",
          width: 18,
        }}
      >
        {index + 1}
      </Text>
      <Text
        selectable={revealed}
        style={{
          color: colors.ink,
          fontFamily: fonts.serif.regular,
          fontSize: 18,
        }}
      >
        {word}
      </Text>
    </Animated.View>
  );
}
