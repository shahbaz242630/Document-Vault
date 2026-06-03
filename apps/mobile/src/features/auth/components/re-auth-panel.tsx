import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import { colors } from "@/shared/theme/colors";

import { createAuthService, type AuthServiceResult } from "../auth-service";
import { createReAuthViewModel } from "../re-auth-view-model";
import { createTotpVerifyService, type TotpVerifyServiceResult } from "../totp-verify-service";

type ReAuthStep = "password" | "totp";
type ReAuthResult = AuthServiceResult | TotpVerifyServiceResult;
type ReAuthViewModel = ReturnType<typeof createReAuthViewModel>;
type AuthService = ReturnType<typeof createAuthService>;
type TotpVerifyService = ReturnType<typeof createTotpVerifyService>;

type ReAuthPanelProps = {
  email: string | null;
  onReAuthSuccess: () => void;
};

export function ReAuthPanel({ email, onReAuthSuccess }: ReAuthPanelProps) {
  const viewModel = createReAuthViewModel();
  const [form, setForm] = useState(() => createInitialFormState(email));
  const authService = useMemo(() => createAuthService(createSupabaseClient()), []);
  const totpService = useMemo(() => createTotpVerifyService(createSupabaseClient()), []);
  const isPasswordStep = form.step === "password";
  const canSubmit = isPasswordStep
    ? form.emailValue.trim().length > 0 && form.password.length > 0
    : form.totpCode.length === 6;

  return (
    <View style={{ gap: 20 }}>
      <ReAuthHeader viewModel={viewModel} />
      {isPasswordStep ? (
        <PasswordStepFields form={form} setForm={setForm} viewModel={viewModel} />
      ) : (
        <TotpStepField form={form} setForm={setForm} viewModel={viewModel} />
      )}
      <ResultMessage result={form.result} />
      <SubmitButton
        canSubmit={canSubmit}
        isSubmitting={form.isSubmitting}
        label={form.isSubmitting ? viewModel.verifyingLabel : viewModel.primaryActionLabel}
        onPress={() =>
          submitReAuth({
            authService,
            form,
            onReAuthSuccess,
            setForm,
            totpService,
          })
        }
      />
      <BypassButton onPress={onReAuthSuccess} result={form.result} viewModel={viewModel} />
    </View>
  );
}

type ReAuthFormState = {
  emailValue: string;
  isSubmitting: boolean;
  password: string;
  result: ReAuthResult | null;
  step: ReAuthStep;
  totpCode: string;
};

function createInitialFormState(email: string | null): ReAuthFormState {
  return {
    emailValue: email ?? "",
    isSubmitting: false,
    password: "",
    result: null,
    step: "password",
    totpCode: "",
  };
}

function ReAuthHeader({ viewModel }: { viewModel: ReAuthViewModel }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Account security</Text>
      <Text style={{ color: colors.ink, fontSize: 30, fontWeight: "700", lineHeight: 36 }}>
        {viewModel.title}
      </Text>
      <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>{viewModel.subtitle}</Text>
    </View>
  );
}

function PasswordStepFields({
  form,
  setForm,
  viewModel,
}: {
  form: ReAuthFormState;
  setForm: (updater: (previous: ReAuthFormState) => ReAuthFormState) => void;
  viewModel: ReAuthViewModel;
}) {
  return (
    <View style={{ gap: 14 }}>
      <AuthTextInput
        autoCapitalize="none"
        inputMode="email"
        label={viewModel.emailLabel}
        onChangeText={(text) => updateFormField(setForm, "emailValue", text)}
        value={form.emailValue}
      />
      <AuthTextInput
        label={viewModel.passwordLabel}
        onChangeText={(text) => updateFormField(setForm, "password", text)}
        secureTextEntry
        value={form.password}
      />
    </View>
  );
}

function TotpStepField({
  form,
  setForm,
  viewModel,
}: {
  form: ReAuthFormState;
  setForm: (updater: (previous: ReAuthFormState) => ReAuthFormState) => void;
  viewModel: ReAuthViewModel;
}) {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <InputLabel>{viewModel.totpLabel}</InputLabel>
        <TextInput
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(text) => updateFormField(setForm, "totpCode", text)}
          placeholder={viewModel.totpPlaceholder}
          placeholderTextColor={colors.inkMuted}
          style={totpInputStyle}
          value={form.totpCode}
        />
      </View>
    </View>
  );
}

function ResultMessage({ result }: { result: ReAuthResult | null }) {
  return result ? (
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
  ) : null;
}

function SubmitButton({
  canSubmit,
  isSubmitting,
  label,
  onPress,
}: {
  canSubmit: boolean;
  isSubmitting: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={isSubmitting || !canSubmit} onPress={onPress} style={primaryButtonStyle(isSubmitting || !canSubmit)}>
      <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function BypassButton({
  onPress,
  result,
  viewModel,
}: {
  onPress: () => void;
  result: ReAuthResult | null;
  viewModel: ReAuthViewModel;
}) {
  return result?.status === "unavailable" ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={secondaryButtonStyle}>
      <Text style={{ color: colors.inkSoft, fontSize: 15, fontWeight: "600" }}>{viewModel.bypassLabel}</Text>
    </Pressable>
  ) : null;
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
      <InputLabel>{label}</InputLabel>
      <TextInput
        autoCapitalize={autoCapitalize}
        inputMode={inputMode}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={textInputStyle}
        value={value}
      />
    </View>
  );
}

function InputLabel({ children }: { children: string }) {
  return <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>{children}</Text>;
}

function updateFormField<K extends keyof ReAuthFormState>(
  setForm: (updater: (previous: ReAuthFormState) => ReAuthFormState) => void,
  field: K,
  value: ReAuthFormState[K],
) {
  setForm((previous) => ({ ...previous, [field]: value, result: null }));
}

async function submitReAuth({
  authService,
  form,
  onReAuthSuccess,
  setForm,
  totpService,
}: {
  authService: AuthService;
  form: ReAuthFormState;
  onReAuthSuccess: () => void;
  setForm: (updater: (previous: ReAuthFormState) => ReAuthFormState) => void;
  totpService: TotpVerifyService;
}) {
  setForm((previous) => ({ ...previous, isSubmitting: true, result: null }));

  try {
    if (form.step === "password") {
      await submitPasswordStep({ authService, form, onReAuthSuccess, setForm });
    } else {
      await submitTotpStep({ form, onReAuthSuccess, setForm, totpService });
    }
  } catch (error) {
    setForm((previous) => ({
      ...previous,
      result: {
        message: error instanceof Error ? error.message : "Verification could not be completed.",
        status: "error",
      },
    }));
  } finally {
    setForm((previous) => ({ ...previous, isSubmitting: false }));
  }
}

async function submitPasswordStep({
  authService,
  form,
  onReAuthSuccess,
  setForm,
}: {
  authService: AuthService;
  form: ReAuthFormState;
  onReAuthSuccess: () => void;
  setForm: (updater: (previous: ReAuthFormState) => ReAuthFormState) => void;
}) {
  const nextResult = await authService.signIn({
    email: form.emailValue,
    password: form.password,
  });

  setForm((previous) => ({
    ...previous,
    result: nextResult,
    step: nextResult.status === "ok" && nextResult.nextStep === "totp-verification" ? "totp" : previous.step,
  }));

  if (nextResult.status === "ok" && nextResult.nextStep !== "totp-verification") {
    onReAuthSuccess();
  }
}

async function submitTotpStep({
  form,
  onReAuthSuccess,
  setForm,
  totpService,
}: {
  form: ReAuthFormState;
  onReAuthSuccess: () => void;
  setForm: (updater: (previous: ReAuthFormState) => ReAuthFormState) => void;
  totpService: TotpVerifyService;
}) {
  const nextResult = await totpService.verify("placeholder-factor-id", form.totpCode);
  setForm((previous) => ({ ...previous, result: nextResult }));

  if (nextResult.status === "ok") {
    onReAuthSuccess();
  }
}

const textInputStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderCurve: "continuous" as const,
  borderRadius: 8,
  borderWidth: 1,
  color: colors.ink,
  fontSize: 17,
  paddingHorizontal: 14,
  paddingVertical: 12,
};

const totpInputStyle = {
  ...textInputStyle,
  letterSpacing: 4,
};

function primaryButtonStyle(disabled: boolean) {
  return {
    alignItems: "center" as const,
    backgroundColor: disabled ? colors.inkMuted : colors.action,
    borderCurve: "continuous" as const,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
  };
}

const secondaryButtonStyle = {
  alignItems: "center" as const,
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderCurve: "continuous" as const,
  borderRadius: 8,
  borderWidth: 1,
  paddingHorizontal: 18,
  paddingVertical: 14,
};
