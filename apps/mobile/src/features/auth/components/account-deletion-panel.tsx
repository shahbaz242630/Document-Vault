import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import Purchases from "react-native-purchases";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import { getApiEnv } from "@/shared/config/api-env";
import { colors } from "@/shared/theme/colors";

import { createAccountDeletionService } from "../account-deletion-service";
import { createApiAccountDeletionRequestRepository } from "../api-account-deletion-request-repository";
import { defaultAuditLog } from "../audit-log";
import { createBiometricStorage } from "../biometric-storage";
import { createMekStorage } from "../mek-storage";
import { createSignupProgressStorage } from "../signup-progress";
import { createAccountDeletionViewModel } from "../account-deletion-view-model";
import type { SecureStorage } from "../signup-progress";

type AccountDeletionPanelProps = {
  lockVault: () => void;
  storage: SecureStorage;
};

type AccountDeletionViewModel = ReturnType<typeof createAccountDeletionViewModel>;

export function AccountDeletionPanel({ lockVault, storage }: AccountDeletionPanelProps) {
  const viewModel = createAccountDeletionViewModel();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const supabaseClient = useMemo(() => createSupabaseClient(), []);
  const apiEnv = useMemo(() => getApiEnv(), []);

  const service = useMemo(
    () => {
      const deletionRequestRepository = supabaseClient && apiEnv.isConfigured
        ? createApiAccountDeletionRequestRepository({
            apiBaseUrl: apiEnv.url,
            supabaseAuth: supabaseClient.auth,
          })
        : null;

      return createAccountDeletionService({
        auditLog: defaultAuditLog,
        biometricStorage: createBiometricStorage(storage),
        deletionRequestRepository,
        mekStorage: createMekStorage(storage),
        progressStorage: createSignupProgressStorage(storage),
      });
    },
    [apiEnv, storage, supabaseClient],
  );

  const canDelete = confirmation.trim() === "DELETE";

  return (
    <View style={{ gap: 20 }}>
      <AccountDeletionHeader viewModel={viewModel} />

      <AccountDeletionConfirmationInput
        label={viewModel.confirmationInputLabel}
        onChange={(text) => {
          setConfirmation(text);
          setError(null);
        }}
        placeholder={viewModel.confirmationPlaceholder}
        value={confirmation}
      />

      {error ? (
        <Text selectable style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}>
          {error}
        </Text>
      ) : null}

      <AccountDeletionButton
        disabled={isDeleting || !canDelete}
        isDeleting={isDeleting}
        label={viewModel.dangerActionLabel}
        onDelete={async () => {
          setIsDeleting(true);
          setError(null);

          try {
            await service.requestDeletion();
            lockVault();
            await service.clearStoredData();
            try {
              await Purchases.logOut();
            } catch {
              // Ignore RevenueCat logout errors (e.g., not configured).
            }
            service.logCompletion();
            router.replace("/");
          } catch (deletionError) {
            setError(
              deletionError instanceof Error
                ? deletionError.message
                : "Account deletion could not be completed.",
            );
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </View>
  );
}

function AccountDeletionHeader({
  viewModel,
}: {
  viewModel: AccountDeletionViewModel;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Account</Text>
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
      <Text
        style={{
          color: colors.danger,
          fontSize: 17,
          fontWeight: "700",
          lineHeight: 25,
        }}
      >
        {viewModel.warningTitle}
      </Text>
      <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
        {viewModel.warningBody}
      </Text>
    </View>
  );
}

function AccountDeletionConfirmationInput({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (text: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
        {label}
      </Text>
      <TextInput
        autoCapitalize="characters"
        onChangeText={onChange}
        placeholder={placeholder}
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

function AccountDeletionButton({
  disabled,
  isDeleting,
  label,
  onDelete,
}: {
  disabled: boolean;
  isDeleting: boolean;
  label: string;
  onDelete: () => Promise<void>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        void onDelete();
      }}
      style={{
        alignItems: "center",
        backgroundColor: disabled ? colors.inkMuted : colors.danger,
        borderCurve: "continuous",
        borderRadius: 8,
        paddingHorizontal: 18,
        paddingVertical: 14,
      }}
    >
      <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
        {isDeleting ? "Deleting..." : label}
      </Text>
    </Pressable>
  );
}
