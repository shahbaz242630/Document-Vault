import { useMemo, useState } from "react";
import { View } from "react-native";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import {
  BodyText,
  CodeField,
  ErrorText,
  Field,
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
  Subtitle,
} from "@/shared/ui";

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
    <View style={{ flex: 1, gap: 22 }}>
      <ScreenHeader />

      <View style={{ gap: 10 }}>
        <SerifTitle>{viewModel.title}</SerifTitle>
        <Subtitle>{viewModel.subtitle}</Subtitle>
      </View>

      {isPasswordStep ? (
        <PasswordStepFields form={form} setForm={setForm} viewModel={viewModel} />
      ) : (
        <TotpStepField form={form} setForm={setForm} viewModel={viewModel} />
      )}
      <ResultMessage result={form.result} />
      <BypassButton onPress={onReAuthSuccess} result={form.result} viewModel={viewModel} />

      <View style={{ marginTop: "auto" }}>
        <PrimaryButton
          disabled={form.isSubmitting || !canSubmit}
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
      </View>
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
      <Field
        autoCapitalize="none"
        inputMode="email"
        label={viewModel.emailLabel}
        onChangeText={(text) => updateFormField(setForm, "emailValue", text)}
        value={form.emailValue}
      />
      <Field
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
    <View style={{ gap: 6 }}>
      <Subtitle>{viewModel.totpLabel}</Subtitle>
      <CodeField
        onChangeText={(text) => updateFormField(setForm, "totpCode", text)}
        value={form.totpCode}
      />
    </View>
  );
}

function ResultMessage({ result }: { result: ReAuthResult | null }) {
  if (!result) {
    return null;
  }
  return result.status === "error" ? (
    <ErrorText>{result.message}</ErrorText>
  ) : (
    <BodyText>{result.message}</BodyText>
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
    <OutlineButton label={viewModel.bypassLabel} onPress={onPress} />
  ) : null;
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
