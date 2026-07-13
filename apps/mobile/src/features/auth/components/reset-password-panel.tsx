import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { usePreventScreenCapture } from "expo-screen-capture";
import { View } from "react-native";

import {
  createSupabaseKeyMaterialRepository,
  type SupabaseKeyMaterialClient,
} from "@/features/vault";
import { createSupabaseClient } from "@/shared/api/supabase-client";
import {
  ErrorText,
  Eyebrow,
  Field,
  GoldHairline,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
  Subtitle,
  TextAreaField,
} from "@/shared/ui";

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
  usePreventScreenCapture();
  const viewModel = createResetPasswordViewModel();
  const isRecover = mode === "recover";
  const [form, setForm] = useState(createInitialFormState());
  const supabaseClient = useMemo(() => createSupabaseClient(), []);
  const service = useMemo(
    () =>
      createPasswordResetService(supabaseClient, {
        keyMaterialRepository: supabaseClient
          ? createSupabaseKeyMaterialRepository(
              supabaseClient as unknown as SupabaseKeyMaterialClient,
            )
          : null,
      }),
    [supabaseClient],
  );
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
    <View style={{ flex: 1, gap: 20 }}>
      <ScreenHeader />

      <View style={{ gap: 10 }}>
        <SerifTitle>{isRecover ? viewModel.recoverTitle : viewModel.freshTitle}</SerifTitle>
        <Subtitle>{isRecover ? viewModel.recoverBody : viewModel.freshBody}</Subtitle>
        {!isRecover ? <ErrorText>{viewModel.freshWarning}</ErrorText> : null}
      </View>

      {isRecover ? (
        <RecoveryFields form={form} onChange={setForm} passwordsMatch={passwordsMatch} viewModel={viewModel} />
      ) : (
        <Field
          autoCapitalize="characters"
          label="Type DELETE to confirm"
          onChangeText={(text) => updateFormField(setForm, "confirmation", text)}
          placeholder="DELETE"
          value={form.confirmation}
        />
      )}

      {form.error ? <ErrorText>{form.error}</ErrorText> : null}

      <View style={{ marginTop: "auto" }}>
        <PrimaryButton
          disabled={form.isSubmitting || !canSubmit}
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
    <View style={{ flex: 1, gap: 20, justifyContent: "center" }}>
      <Eyebrow>Done</Eyebrow>
      <SerifTitle size={34}>
        {isRecover ? "Your vault has a new password." : "Your account has been reset."}
      </SerifTitle>
      <GoldHairline animated delayMs={400} />
      <Subtitle style={{ lineHeight: 25 }}>
        {isRecover
          ? "Everything inside is untouched and still sealed. Sign in with your new password to continue."
          : "You can now create a new vault and start fresh."}
      </Subtitle>
      <PrimaryButton
        label={isRecover ? "Sign in" : "Create new vault"}
        onPress={onContinue}
        style={{ marginTop: 8 }}
      />
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
      <TextAreaField
        accessibilityLabel="Recovery phrase input"
        autoCapitalize="none"
        label={viewModel.phraseInputLabel}
        onChangeText={(text) => updateFormField(onChange, "phraseText", text)}
        placeholder={viewModel.phrasePlaceholder}
        value={form.phraseText}
      />
      <Field
        accessibilityLabel="New password input"
        hint="At least 12 characters."
        label={viewModel.newPasswordLabel}
        onChangeText={(text) => updateFormField(onChange, "newPassword", text)}
        secureTextEntry
        value={form.newPassword}
      />
      <Field
        accessibilityLabel="Confirm new password input"
        label={viewModel.confirmPasswordLabel}
        onChangeText={(text) => updateFormField(onChange, "confirmPassword", text)}
        secureTextEntry
        value={form.confirmPassword}
      />
      {form.confirmPassword.length > 0 && !passwordsMatch ? (
        <ErrorText>Passwords do not match.</ErrorText>
      ) : null}
    </View>
  );
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
