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

export function ResetPasswordPanel({ lockVault, mode, storage }: ResetPasswordPanelProps) {
  const viewModel = createResetPasswordViewModel();
  const isRecover = mode === "recover";

  const [phraseText, setPhraseText] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const service = useMemo(
    () => createPasswordResetService(createSupabaseClient()),
    [],
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

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit = isRecover
    ? phraseText.trim().length > 0 &&
      newPassword.length >= 12 &&
      passwordsMatch
    : confirmation.trim() === "DELETE";

  if (success) {
    return (
      <View style={{ gap: 20 }}>
        <Text
          style={{
            color: colors.ink,
            fontSize: 30,
            fontWeight: "700",
            lineHeight: 36,
          }}
        >
          {isRecover ? "Sanduqkin recovered" : "Account reset"}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          {isRecover
            ? "Your vault has been recovered with the new password. Sign in to continue."
            : "Your account has been reset. You can now create a new vault."}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            router.replace("/auth/sign-in");
          }}
          style={{
            alignItems: "center",
            backgroundColor: colors.action,
            borderCurve: "continuous",
            borderRadius: 8,
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}
        >
          <Text
            style={{
              color: colors.actionText,
              fontSize: 17,
              fontWeight: "700",
            }}
          >
            {isRecover ? "Sign in" : "Create new vault"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
          Account recovery
        </Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: 30,
            fontWeight: "700",
            lineHeight: 36,
          }}
        >
          {isRecover ? viewModel.recoverTitle : viewModel.freshTitle}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          {isRecover ? viewModel.recoverBody : viewModel.freshBody}
        </Text>
        {!isRecover ? (
          <Text
            style={{
              color: colors.danger,
              fontSize: 17,
              fontWeight: "700",
              lineHeight: 25,
            }}
          >
            {viewModel.freshWarning}
          </Text>
        ) : null}
      </View>

      {isRecover ? (
        <View style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text
              style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}
            >
              {viewModel.phraseInputLabel}
            </Text>
            <TextInput
              autoCapitalize="none"
              multiline
              onChangeText={(text) => {
                setPhraseText(text);
                setError(null);
              }}
              placeholder={viewModel.phrasePlaceholder}
              placeholderTextColor={colors.inkMuted}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderCurve: "continuous",
                borderRadius: 8,
                borderWidth: 1,
                color: colors.ink,
                fontSize: 17,
                minHeight: 80,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
              value={phraseText}
            />
          </View>
          <PasswordInput
            label={viewModel.newPasswordLabel}
            onChangeText={(text) => {
              setNewPassword(text);
              setError(null);
            }}
            value={newPassword}
          />
          <PasswordInput
            label={viewModel.confirmPasswordLabel}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setError(null);
            }}
            value={confirmPassword}
          />
          {confirmPassword.length > 0 && !passwordsMatch ? (
            <Text style={{ color: colors.danger, fontSize: 15 }}>
              Passwords do not match.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
            Type DELETE to confirm
          </Text>
          <TextInput
            autoCapitalize="characters"
            onChangeText={(text) => {
              setConfirmation(text);
              setError(null);
            }}
            placeholder="DELETE"
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
            value={confirmation}
          />
        </View>
      )}

      {error ? (
        <Text
          selectable
          style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting || !canSubmit}
        onPress={async () => {
          setIsSubmitting(true);
          setError(null);

          try {
            if (isRecover) {
              const words = phraseText
                .trim()
                .toLowerCase()
                .split(/\s+/)
                .filter(Boolean);

              const result = await service.resetWithRecoveryPhrase({
                newPassword,
                phrase: words,
              });

              if (result.status === "error") {
                setError(result.message);
                setIsSubmitting(false);
                return;
              }

              const mekStorage = createMekStorage(storage);
              await mekStorage.set(result.mekBase64);
              setSuccess(true);
            } else {
              deletionService.logRequest();
              lockVault();
              await deletionService.clearStoredData();
              deletionService.logCompletion();
              setSuccess(true);
            }
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Request could not be completed.",
            );
          } finally {
            setIsSubmitting(false);
          }
        }}
        style={{
          alignItems: "center",
          backgroundColor: isSubmitting || !canSubmit ? colors.inkMuted : colors.danger,
          borderCurve: "continuous",
          borderRadius: 8,
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}
      >
        <Text
          style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}
        >
          {isSubmitting ? viewModel.verifyingLabel : viewModel.primaryActionLabel}
        </Text>
      </Pressable>
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
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
        {label}
      </Text>
      <TextInput
        onChangeText={onChangeText}
        secureTextEntry
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
