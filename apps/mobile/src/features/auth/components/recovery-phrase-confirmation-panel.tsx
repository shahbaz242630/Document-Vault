import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import {
  createConfirmationChallenge,
  validateConfirmationInputs,
  type ConfirmationChallenge,
} from "../recovery-phrase-confirmation";
import { createRecoveryPhraseConfirmationViewModel } from "../recovery-phrase-confirmation-view-model";

type RecoveryPhraseConfirmationPanelProps = {
  onConfirmed: () => Promise<void>;
  words: readonly string[];
};

export function RecoveryPhraseConfirmationPanel({
  onConfirmed,
  words,
}: RecoveryPhraseConfirmationPanelProps) {
  const viewModel = createRecoveryPhraseConfirmationViewModel();
  const challenges = useMemo(() => createConfirmationChallenge(words), [words]);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allFilled = challenges.every(
    (challenge) => (inputs[challenge.position] ?? "").trim().length > 0,
  );

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

      <View style={{ gap: 14 }}>
        {challenges.map((challenge) => (
          <ChallengeInput
            key={challenge.position}
            challenge={challenge}
            value={inputs[challenge.position] ?? ""}
            onChangeText={(text) => {
              setInputs((current) => ({
                ...current,
                [challenge.position]: text,
              }));
              setError(null);
            }}
          />
        ))}
      </View>

      {error ? (
        <Text selectable style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}>
          {error}
        </Text>
      ) : null}

      {success ? (
        <Text selectable style={{ color: colors.action, fontSize: 15, lineHeight: 22 }}>
          {viewModel.successMessage}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting || !allFilled || success}
        onPress={async () => {
          setIsSubmitting(true);

          try {
            const inputValues = challenges.map((challenge) => ({
              position: challenge.position,
              value: inputs[challenge.position] ?? "",
            }));

            const isValid = validateConfirmationInputs(words, inputValues);

            if (isValid) {
              await onConfirmed();
              setSuccess(true);
              setError(null);
            } else {
              setError("One or more words do not match. Please check your recovery phrase and try again.");
              setSuccess(false);
            }
          } finally {
            setIsSubmitting(false);
          }
        }}
        style={{
          alignItems: "center",
          backgroundColor:
            isSubmitting || !allFilled || success ? colors.inkMuted : colors.action,
          borderCurve: "continuous",
          borderRadius: 8,
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
          {isSubmitting ? "Verifying..." : viewModel.primaryActionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

type ChallengeInputProps = {
  challenge: ConfirmationChallenge;
  onChangeText: (text: string) => void;
  value: string;
};

function ChallengeInput({ challenge, onChangeText, value }: ChallengeInputProps) {
  const viewModel = createRecoveryPhraseConfirmationViewModel();

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
        Word #{challenge.position}
      </Text>
      <TextInput
        autoCapitalize="none"
        onChangeText={onChangeText}
        placeholder={viewModel.inputPlaceholder}
        placeholderTextColor={colors.inkMuted}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: "continuous",
          borderRadius: 8,
          borderWidth: 1,
          color: colors.ink,
          fontSize: 17,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
        value={value}
      />
    </View>
  );
}
