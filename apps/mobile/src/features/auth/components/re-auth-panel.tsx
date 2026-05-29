import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import { colors } from "@/shared/theme/colors";

import { createAuthService, type AuthServiceResult } from "../auth-service";
import { createReAuthViewModel } from "../re-auth-view-model";
import { createTotpVerifyService, type TotpVerifyServiceResult } from "../totp-verify-service";

type ReAuthStep = "password" | "totp";

type ReAuthResult = AuthServiceResult | TotpVerifyServiceResult;

type ReAuthPanelProps = {
  email: string | null;
  onReAuthSuccess: () => void;
};

export function ReAuthPanel({ email, onReAuthSuccess }: ReAuthPanelProps) {
  const viewModel = createReAuthViewModel();
  const [emailValue, setEmailValue] = useState(email ?? "");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [step, setStep] = useState<ReAuthStep>("password");
  const [result, setResult] = useState<ReAuthResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authService = useMemo(() => createAuthService(createSupabaseClient()), []);
  const totpService = useMemo(() => createTotpVerifyService(createSupabaseClient()), []);

  const isPasswordStep = step === "password";
  const canSubmit = isPasswordStep
    ? emailValue.trim().length > 0 && password.length > 0
    : totpCode.length === 6;

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Account security</Text>
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
          {viewModel.subtitle}
        </Text>
      </View>

      {isPasswordStep ? (
        <View style={{ gap: 14 }}>
          <AuthTextInput
            autoCapitalize="none"
            inputMode="email"
            label={viewModel.emailLabel}
            onChangeText={(text) => {
              setEmailValue(text);
              setResult(null);
            }}
            value={emailValue}
          />
          <AuthTextInput
            label={viewModel.passwordLabel}
            onChangeText={(text) => {
              setPassword(text);
              setResult(null);
            }}
            secureTextEntry
            value={password}
          />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
              {viewModel.totpLabel}
            </Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(text) => {
                setTotpCode(text);
                setResult(null);
              }}
              placeholder={viewModel.totpPlaceholder}
              placeholderTextColor={colors.inkMuted}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderCurve: "continuous",
                borderRadius: 8,
                borderWidth: 1,
                color: colors.ink,
                fontSize: 17,
                letterSpacing: 4,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
              value={totpCode}
            />
          </View>
        </View>
      )}

      {result ? (
        <Text
          selectable
          style={{
            color: result.status === "error" ? colors.danger : colors.inkSoft,
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          {result.message}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting || !canSubmit}
        onPress={async () => {
          setIsSubmitting(true);
          setResult(null);

          try {
            if (isPasswordStep) {
              const nextResult = await authService.signIn({
                email: emailValue,
                password,
              });

              setResult(nextResult);

              if (nextResult.status === "ok" && nextResult.nextStep === "totp-verification") {
                setStep("totp");
              } else if (nextResult.status === "ok") {
                onReAuthSuccess();
              }
            } else {
              const nextResult = await totpService.verify("placeholder-factor-id", totpCode);

              setResult(nextResult);

              if (nextResult.status === "ok") {
                onReAuthSuccess();
              }
            }
          } catch (error) {
            setResult({
              message: error instanceof Error ? error.message : "Verification could not be completed.",
              status: "error",
            });
          } finally {
            setIsSubmitting(false);
          }
        }}
        style={{
          alignItems: "center",
          backgroundColor: isSubmitting || !canSubmit ? colors.inkMuted : colors.action,
          borderCurve: "continuous",
          borderRadius: 8,
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
          {isSubmitting ? viewModel.verifyingLabel : viewModel.primaryActionLabel}
        </Text>
      </Pressable>

      {result?.status === "unavailable" ? (
        <Pressable
          accessibilityRole="button"
          onPress={onReAuthSuccess}
          style={{
            alignItems: "center",
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderCurve: "continuous",
            borderRadius: 8,
            borderWidth: 1,
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}
        >
          <Text style={{ color: colors.inkSoft, fontSize: 15, fontWeight: "600" }}>
            {viewModel.bypassLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type AuthTextInputProps = {
  autoCapitalize?: "none";
  inputMode?: "email";
  label: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  value: string;
};

function AuthTextInput({
  autoCapitalize,
  inputMode,
  label,
  onChangeText,
  secureTextEntry,
  value,
}: AuthTextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        inputMode={inputMode}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
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
