import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import { colors } from "@/shared/theme/colors";

import { createPasswordResetService } from "../password-reset-service";
import { createResetPasswordViewModel, type ResetPasswordMode } from "../reset-password-view-model";
import { createAccountDeletionService } from "../account-deletion-service";
import { defaultAuditLog } from "../audit-log";
import { createBiometricStorage } from "../biometric-storage";
import { createMekStorage } from "../mek-storage";
import { createSignupProgressStorage } from "../signup-progress";
import type { SecureStorage } from "../signup-progress";

type ResetPasswordPanelProps = {
  lockVault: () => void;
  mode: ResetPasswordMode;
  storage: SecureStorage;
};

type ResetPasswordViewModel = ReturnType<typeof createResetPasswordViewModel>;
type PasswordResetService = ReturnType<typeof createPasswordResetService>;
type AccountDeletionService = ReturnType<typeof createAccountDeletionService>;

export function ResetPasswordPanel({ lockVault, mode, storage }: ResetPasswordPanelProps) {
  const viewModel = createResetPasswordViewModel();
  const isRecover = mode === "recover";
  const [form, setForm] = useState(createInitialFormState());
  const service = useMemo(() => createPasswordResetService(createSupabaseClient()), []);
  const deletionService = useMemo(
    () =>
      createAccountDeletionService({
        auditLog: defaultAuditLog,
        biometricStorage: createBiometricStorage(storage),
        mekStorage: createMekStorage(storage),
        progressStorage: createSignupProgressStorage(storage),
      }),
    [storage],
  );
  const router = useRouter();
  const passwordsMatch = form.newPassword === form.confirmPassword;
  const canSubmit = isRecover
    ? form.phraseText.trim().length > 0 && form.newPassword.length >= 12 && passwordsMatch
    : form.confirmation.trim() === "DELETE";

  if (form.success) {
    return <ResetPasswordSuccess isRecover={isRecover} onContinue={() => router.replace("/auth/sign-in")} />;
  }

  return (
    <View style={{ gap: 20 }}>
      <ResetPasswordHeader isRecover={isRecover} viewModel={viewModel} />
      {isRecover ? (
        <RecoveryFields form={form} onChange={setForm} passwordsMatch={passwordsMatch} viewModel={viewModel} />
      ) : (
        <FreshResetField confirmation={form.confirmation} onChange={setForm} />
      )}
      <ErrorMessage error={form.error} />
      <PrimaryButton
        canSubmit={canSubmit}
        isSubmitting={form.isSubmitting}
        label={form.isSubmitting ? viewModel.verifyingLabel : viewModel.primaryActionLabel}
        onPress={() =>
          submitResetPasswordForm({
            deletionService,
            form,
            isRecover,
            lockVault,
            service,
            setForm,
            storage,
          })
        }
      />
    </View>
  );
}

type FormState = {
  confirmPassword: string;
  confirmation: string;
  error: string | null;
  isSubmitting: boolean;
  newPassword: string;
  phraseText: string;
  success: boolean;
};

function createInitialFormState(): FormState {
  return {
    confirmPassword: "",
    confirmation: "",
    error: null,
    isSubmitting: false,
    newPassword: "",
    phraseText: "",
    success: false,
  };
}

function ResetPasswordSuccess({ isRecover, onContinue }: { isRecover: boolean; onContinue: () => void }) {
  return (
    <View style={{ gap: 20 }}>
      <ScreenTitle>{isRecover ? "Sanduqkin recovered" : "Account reset"}</ScreenTitle>
      <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
        {isRecover
          ? "Your vault has been recovered with the new password. Sign in to continue."
          : "Your account has been reset. You can now create a new vault."}
      </Text>
      <ActionButton color={colors.action} disabled={false} label={isRecover ? "Sign in" : "Create new vault"} onPress={onContinue} />
    </View>
  );
}

function ResetPasswordHeader({ isRecover, viewModel }: { isRecover: boolean; viewModel: ResetPasswordViewModel }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Account recovery</Text>
      <ScreenTitle>{isRecover ? viewModel.recoverTitle : viewModel.freshTitle}</ScreenTitle>
      <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
        {isRecover ? viewModel.recoverBody : viewModel.freshBody}
      </Text>
      {!isRecover ? <WarningText>{viewModel.freshWarning}</WarningText> : null}
    </View>
  );
}

function RecoveryFields({
  form,
  onChange,
  passwordsMatch,
  viewModel,
}: {
  form: FormState;
  onChange: (updater: (previous: FormState) => FormState) => void;
  passwordsMatch: boolean;
  viewModel: ResetPasswordViewModel;
}) {
  return (
    <View style={{ gap: 14 }}>
      <PhraseInput form={form} onChange={onChange} viewModel={viewModel} />
      <PasswordInput
        label={viewModel.newPasswordLabel}
        onChangeText={(text) => updateFormField(onChange, "newPassword", text)}
        value={form.newPassword}
      />
      <PasswordInput
        label={viewModel.confirmPasswordLabel}
        onChangeText={(text) => updateFormField(onChange, "confirmPassword", text)}
        value={form.confirmPassword}
      />
      {form.confirmPassword.length > 0 && !passwordsMatch ? (
        <Text style={{ color: colors.danger, fontSize: 15 }}>Passwords do not match.</Text>
      ) : null}
    </View>
  );
}

function PhraseInput({
  form,
  onChange,
  viewModel,
}: {
  form: FormState;
  onChange: (updater: (previous: FormState) => FormState) => void;
  viewModel: ResetPasswordViewModel;
}) {
  return (
    <View style={{ gap: 6 }}>
      <InputLabel>{viewModel.phraseInputLabel}</InputLabel>
      <TextInput
        autoCapitalize="none"
        multiline
        onChangeText={(text) => updateFormField(onChange, "phraseText", text)}
        placeholder={viewModel.phrasePlaceholder}
        placeholderTextColor={colors.inkMuted}
        style={{ ...textInputStyle, minHeight: 80 }}
        value={form.phraseText}
      />
    </View>
  );
}

function FreshResetField({
  confirmation,
  onChange,
}: {
  confirmation: string;
  onChange: (updater: (previous: FormState) => FormState) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <InputLabel>Type DELETE to confirm</InputLabel>
      <TextInput
        autoCapitalize="characters"
        onChangeText={(text) => updateFormField(onChange, "confirmation", text)}
        placeholder="DELETE"
        placeholderTextColor={colors.inkMuted}
        style={textInputStyle}
        value={confirmation}
      />
    </View>
  );
}

type PasswordInputProps = {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
};

function PasswordInput({ label, onChangeText, value }: PasswordInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <InputLabel>{label}</InputLabel>
      <TextInput onChangeText={onChangeText} secureTextEntry style={textInputStyle} value={value} />
    </View>
  );
}

function PrimaryButton({
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
  const disabled = isSubmitting || !canSubmit;
  return <ActionButton color={disabled ? colors.inkMuted : colors.danger} disabled={disabled} label={label} onPress={onPress} />;
}

function ActionButton({
  color,
  disabled,
  label,
  onPress,
}: {
  color: string;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={buttonStyle(color)}>
      <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function ErrorMessage({ error }: { error: string | null }) {
  return error ? (
    <Text selectable style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}>
      {error}
    </Text>
  ) : null;
}

function ScreenTitle({ children }: { children: string }) {
  return <Text style={{ color: colors.ink, fontSize: 30, fontWeight: "700", lineHeight: 36 }}>{children}</Text>;
}

function WarningText({ children }: { children: string }) {
  return (
    <Text style={{ color: colors.danger, fontSize: 17, fontWeight: "700", lineHeight: 25 }}>
      {children}
    </Text>
  );
}

function InputLabel({ children }: { children: string }) {
  return <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>{children}</Text>;
}

function updateFormField<K extends keyof FormState>(
  setForm: (updater: (previous: FormState) => FormState) => void,
  field: K,
  value: FormState[K],
) {
  setForm((previous) => ({ ...previous, [field]: value, error: null }));
}

async function submitResetPasswordForm({
  deletionService,
  form,
  isRecover,
  lockVault,
  service,
  setForm,
  storage,
}: {
  deletionService: AccountDeletionService;
  form: FormState;
  isRecover: boolean;
  lockVault: () => void;
  service: PasswordResetService;
  setForm: (updater: (previous: FormState) => FormState) => void;
  storage: SecureStorage;
}) {
  setForm((previous) => ({ ...previous, error: null, isSubmitting: true }));

  try {
    if (isRecover) {
      await recoverVaultWithPhrase({ form, service, setForm, storage });
    } else {
      await resetAccount({ deletionService, lockVault, setForm });
    }
  } catch (err) {
    setForm((previous) => ({
      ...previous,
      error: err instanceof Error ? err.message : "Request could not be completed.",
    }));
  } finally {
    setForm((previous) => ({ ...previous, isSubmitting: false }));
  }
}

async function recoverVaultWithPhrase({
  form,
  service,
  setForm,
  storage,
}: {
  form: FormState;
  service: PasswordResetService;
  setForm: (updater: (previous: FormState) => FormState) => void;
  storage: SecureStorage;
}) {
  const result = await service.resetWithRecoveryPhrase({
    newPassword: form.newPassword,
    phrase: normalizeRecoveryPhrase(form.phraseText),
  });

  if (result.status === "error") {
    setForm((previous) => ({ ...previous, error: result.message }));
    return;
  }

  await createMekStorage(storage).set(result.mekBase64);
  setForm((previous) => ({ ...previous, success: true }));
}

async function resetAccount({
  deletionService,
  lockVault,
  setForm,
}: {
  deletionService: AccountDeletionService;
  lockVault: () => void;
  setForm: (updater: (previous: FormState) => FormState) => void;
}) {
  deletionService.logRequest();
  lockVault();
  await deletionService.clearStoredData();
  deletionService.logCompletion();
  setForm((previous) => ({ ...previous, success: true }));
}

function normalizeRecoveryPhrase(phraseText: string) {
  return phraseText.trim().toLowerCase().split(/\s+/).filter(Boolean);
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

function buttonStyle(backgroundColor: string) {
  return {
    alignItems: "center" as const,
    backgroundColor,
    borderCurve: "continuous" as const,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
  };
}
