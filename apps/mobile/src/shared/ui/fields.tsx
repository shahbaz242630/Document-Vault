import { useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";

import { FieldLabel, MutedText } from "./text";

type FieldProps = TextInputProps & {
  label?: string;
  hint?: string;
};

/** Labeled single-line input on a card surface; border turns green on focus. */
export function Field({ label, hint, style, ...inputProps }: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <TextInput
        placeholderTextColor={colors.inkMuted}
        {...inputProps}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        style={[
          {
            backgroundColor: colors.surface,
            borderColor: focused ? colors.action : colors.border,
            borderCurve: "continuous",
            borderRadius: 10,
            borderWidth: 1,
            color: colors.ink,
            fontFamily: fonts.sans.regular,
            fontSize: 17,
            paddingHorizontal: 14,
            paddingVertical: 13,
          },
          style,
        ]}
      />
      {hint ? <MutedText style={{ fontSize: 13 }}>{hint}</MutedText> : null}
    </View>
  );
}

/** Large centered one-time-code input in mono with wide letter spacing. */
export function CodeField({ style, ...inputProps }: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      autoComplete="one-time-code"
      inputMode="numeric"
      maxLength={6}
      placeholder="••••••"
      placeholderTextColor={colors.inkMuted}
      textContentType="oneTimeCode"
      {...inputProps}
      onBlur={(event) => {
        setFocused(false);
        inputProps.onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        inputProps.onFocus?.(event);
      }}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: focused ? colors.action : colors.border,
          borderCurve: "continuous",
          borderRadius: 10,
          borderWidth: 1,
          color: colors.ink,
          fontFamily: fonts.mono.regular,
          fontSize: 26,
          letterSpacing: 12,
          paddingHorizontal: 16,
          paddingVertical: 16,
          textAlign: "center",
        },
        style,
      ]}
    />
  );
}

/** Labeled multi-line input, e.g. notes or the recovery phrase. */
export function TextAreaField({
  label,
  hint,
  rows = 3,
  style,
  ...inputProps
}: FieldProps & { rows?: number }) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <TextInput
        multiline
        numberOfLines={rows}
        placeholderTextColor={colors.inkMuted}
        {...inputProps}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        style={[
          {
            backgroundColor: colors.surface,
            borderColor: focused ? colors.action : colors.border,
            borderCurve: "continuous",
            borderRadius: 10,
            borderWidth: 1,
            color: colors.ink,
            fontFamily: fonts.sans.regular,
            fontSize: 16,
            minHeight: rows * 24 + 26,
            paddingHorizontal: 14,
            paddingVertical: 13,
            textAlignVertical: "top",
          },
          style,
        ]}
      />
      {hint ? <MutedText style={{ fontSize: 13 }}>{hint}</MutedText> : null}
    </View>
  );
}
