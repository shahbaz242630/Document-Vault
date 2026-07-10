import { useState } from "react";
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

type RecoveryPhraseViewModel = ReturnType<typeof createRecoveryPhraseViewModel>;

export function RecoveryPhrasePanel({
  generateRandomBytes,
  onContinue,
}: RecoveryPhrasePanelProps) {
  const viewModel = createRecoveryPhraseViewModel();
  const [{ mek, words }] = useState(() =>
    generateRecoveryPhraseAndMEK(generateRandomBytes),
  );
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <View style={{ gap: 20 }}>
      <RecoveryPhraseHeader viewModel={viewModel} />
      <RecoveryPhraseWords words={words} />

      <Text
        selectable
        style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}
      >
        {viewModel.warning}
      </Text>

      <RecoveryPhraseAcknowledgment
        acknowledged={acknowledged}
        label={viewModel.primaryActionLabel}
        onToggle={() => setAcknowledged((current) => !current)}
      />

      <RecoveryPhraseContinueAction
        acknowledged={acknowledged}
        onContinue={() => onContinue({ mek, words })}
      />
    </View>
  );
}

function RecoveryPhraseHeader({
  viewModel,
}: {
  viewModel: RecoveryPhraseViewModel;
}) {
  return (
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
  );
}

function RecoveryPhraseWords({ words }: { words: readonly string[] }) {
  return (
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
      {words.map((word, index) => (
        <RecoveryPhraseWord index={index} key={index} word={word} />
      ))}
    </View>
  );
}

function RecoveryPhraseWord({ index, word }: { index: number; word: string }) {
  return (
    <View
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
  );
}

function RecoveryPhraseAcknowledgment({
  acknowledged,
  label,
  onToggle,
}: {
  acknowledged: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onToggle}
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 12,
      }}
    >
      <RecoveryPhraseCheckbox acknowledged={acknowledged} />
      <Text style={{ color: colors.ink, flex: 1, fontSize: 15, lineHeight: 22 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function RecoveryPhraseCheckbox({ acknowledged }: { acknowledged: boolean }) {
  return (
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
        <Text style={{ color: colors.actionText, fontSize: 14 }}>âœ“</Text>
      ) : null}
    </View>
  );
}

function RecoveryPhraseContinueAction({
  acknowledged,
  onContinue,
}: {
  acknowledged: boolean;
  onContinue: () => void;
}) {
  if (acknowledged) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onContinue}
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
    );
  }

  return (
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
  );
}
