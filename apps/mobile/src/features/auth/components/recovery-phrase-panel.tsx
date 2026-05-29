import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

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
  const [words, setWords] = useState<string[] | null>(null);
  const [mek, setMek] = useState<Uint8Array | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const { mek, words } = generateRecoveryPhraseAndMEK(generateRandomBytes);
    setWords(words);
    setMek(mek);
  }, [generateRandomBytes]);

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
          {viewModel.statusLabel}
        </Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: 30,
            fontWeight: "700",
            lineHeight: 36,
          }}
        >
          {viewModel.title}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          {viewModel.body}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: "continuous",
          borderRadius: 12,
          borderWidth: 1,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          padding: 16,
        }}
      >
        {words?.map((word, index) => (
          <View
            key={index}
            style={{
              alignItems: "center",
              backgroundColor: colors.background,
              borderCurve: "continuous",
              borderRadius: 8,
              flexDirection: "row",
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: colors.inkMuted, fontSize: 13, fontWeight: "700" }}>
              {index + 1}
            </Text>
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
              {word}
            </Text>
          </View>
        ))}
      </View>

      <Text
        selectable
        style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}
      >
        {viewModel.warning}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => setAcknowledged((current) => !current)}
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: 12,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: acknowledged ? colors.action : colors.surface,
            borderColor: acknowledged ? colors.action : colors.border,
            borderCurve: "continuous",
            borderRadius: 6,
            borderWidth: 2,
            height: 24,
            justifyContent: "center",
            width: 24,
          }}
        >
          {acknowledged ? (
            <Text style={{ color: colors.actionText, fontSize: 14 }}>✓</Text>
          ) : null}
        </View>
        <Text style={{ color: colors.ink, flex: 1, fontSize: 15, lineHeight: 22 }}>
          {viewModel.primaryActionLabel}
        </Text>
      </Pressable>

      {acknowledged && words && mek ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onContinue({ mek, words })}
          style={{
            alignItems: "center",
            backgroundColor: colors.action,
            borderCurve: "continuous",
            borderRadius: 8,
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}
        >
          <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
            Continue to vault
          </Text>
        </Pressable>
      ) : (
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.inkMuted,
            borderCurve: "continuous",
            borderRadius: 8,
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}
        >
          <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
            Continue to vault
          </Text>
        </View>
      )}
    </View>
  );
}
