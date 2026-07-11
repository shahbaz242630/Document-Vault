import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  BodyText,
  ErrorText,
  Field,
  FieldLabel,
  PrimaryButton,
  SerifTitle,
  StepHeader,
  Subtitle,
} from "@/shared/ui";

import {
  createConfirmationChallenge,
  validateConfirmationInputs,
  type ConfirmationChallenge,
} from "../recovery-phrase-confirmation";
import { createRecoveryPhraseConfirmationViewModel } from "../recovery-phrase-confirmation-view-model";

type RecoveryPhraseConfirmationPanelProps = {
  onConfirmed: (password: string) => Promise<void>;
  words: readonly string[];
};

export function RecoveryPhraseConfirmationPanel({
  onConfirmed,
  words,
}: RecoveryPhraseConfirmationPanelProps) {
  const viewModel = createRecoveryPhraseConfirmationViewModel();
  const challenges = useMemo(() => createConfirmationChallenge(words), [words]);
  const optionsByPosition = useMemo(
    () => buildWordOptions(challenges, words),
    [challenges, words],
  );
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allPicked = challenges.every(
    (challenge) => (picks[challenge.position] ?? "").length > 0,
  );
  const canSubmit = allPicked && password.trim().length > 0;

  return (
    <View style={{ flex: 1, gap: 18 }}>
      <StepHeader step="recovery-2" />

      <View style={{ gap: 10 }}>
        <SerifTitle>{viewModel.title}</SerifTitle>
        <Subtitle>{viewModel.body}</Subtitle>
      </View>

      <View style={{ gap: 18 }}>
        {challenges.map((challenge) => (
          <WordPickGroup
            key={challenge.position}
            label={`Word #${challenge.position}`}
            onPick={(word) => {
              setPicks((current) => ({
                ...current,
                [challenge.position]: word,
              }));
              setError(null);
            }}
            options={optionsByPosition[challenge.position] ?? []}
            picked={picks[challenge.position] ?? null}
          />
        ))}
      </View>

      <Field
        label="Account password"
        onChangeText={(value) => {
          setPassword(value);
          setError(null);
        }}
        placeholder="Re-enter your password"
        secureTextEntry
        value={password}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}
      {success ? <BodyText>{viewModel.successMessage}</BodyText> : null}

      <View style={{ marginTop: "auto" }}>
        <PrimaryButton
          disabled={isSubmitting || !canSubmit || success}
          label={isSubmitting ? "Verifying..." : viewModel.primaryActionLabel}
          onPress={() => {
            void submitConfirmation();
          }}
        />
      </View>
    </View>
  );

  async function submitConfirmation() {
    setIsSubmitting(true);

    try {
      const inputValues = challenges.map((challenge) => ({
        position: challenge.position,
        value: picks[challenge.position] ?? "",
      }));

      const isValid = validateConfirmationInputs(words, inputValues);

      if (isValid) {
        await onConfirmed(password);
        setSuccess(true);
        setError(null);
      } else {
        setError(
          "One or more don't match. Check your written copy and try again.",
        );
        setSuccess(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }
}

/**
 * For each challenge position, offer the correct word plus two decoys drawn
 * from the rest of the phrase, shuffled — matching the design's word picker.
 */
function buildWordOptions(
  challenges: ConfirmationChallenge[],
  words: readonly string[],
): Record<number, string[]> {
  const options: Record<number, string[]> = {};

  for (const challenge of challenges) {
    const decoys = shuffle(
      words.filter((word) => word !== challenge.word),
    ).slice(0, 2);
    options[challenge.position] = shuffle([challenge.word, ...decoys]);
  }

  return options;
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function WordPickGroup({
  label,
  onPick,
  options,
  picked,
}: {
  label: string;
  onPick: (word: string) => void;
  options: string[];
  picked: string | null;
}) {
  return (
    <View style={{ gap: 8 }}>
      <FieldLabel>{label}</FieldLabel>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {options.map((word) => {
          const isPicked = picked === word;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isPicked }}
              key={word}
              onPress={() => onPick(word)}
              style={{
                alignItems: "center",
                backgroundColor: isPicked
                  ? colors.successSurface
                  : colors.surface,
                borderColor: isPicked ? colors.action : colors.border,
                borderCurve: "continuous",
                borderRadius: 10,
                borderWidth: 1.5,
                flex: 1,
                paddingHorizontal: 6,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  color: isPicked ? colors.action : colors.ink,
                  fontFamily: fonts.serif.regular,
                  fontSize: 17,
                }}
              >
                {word}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
