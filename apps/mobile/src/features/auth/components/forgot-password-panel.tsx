import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import { colors } from "@/shared/theme/colors";

import { createPasswordResetService } from "../password-reset-service";
import { createForgotPasswordViewModel } from "../forgot-password-view-model";

type ForgotPasswordViewModel = ReturnType<typeof createForgotPasswordViewModel>;
type PasswordResetService = ReturnType<typeof createPasswordResetService>;
type RequestResetResult = { message: string; status: "error" | "ok" | "unavailable" };
type AppRouter = ReturnType<typeof useRouter>;

export function ForgotPasswordPanel() {
  const viewModel = createForgotPasswordViewModel();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<RequestResetResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const service = useMemo(() => createPasswordResetService(createSupabaseClient()), []);
  const router = useRouter();
  const canSubmit = email.trim().length > 0 && !isSubmitting;

  return (
    <View style={{ gap: 20 }}>
      <ForgotPasswordHeader viewModel={viewModel} />
      <EmailField email={email} setEmail={setEmail} setResult={setResult} viewModel={viewModel} />
      <ResultMessage result={result} />
      <SubmitButton
        canSubmit={canSubmit}
        isSubmitting={isSubmitting}
        label={viewModel.primaryActionLabel}
        onPress={() => submitForgotPasswordRequest({ email, service, setIsSubmitting, setResult })}
      />
      <UnavailableMessage result={result} viewModel={viewModel} />
      <RecoveryActions router={router} viewModel={viewModel} />
    </View>
  );
}

function ForgotPasswordHeader({ viewModel }: { viewModel: ForgotPasswordViewModel }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Account recovery</Text>
      <Text style={{ color: colors.ink, fontSize: 30, fontWeight: "700", lineHeight: 36 }}>
        {viewModel.title}
      </Text>
      <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>{viewModel.body}</Text>
    </View>
  );
}

function EmailField({
  email,
  setEmail,
  setResult,
  viewModel,
}: {
  email: string;
  setEmail: (email: string) => void;
  setResult: (result: RequestResetResult | null) => void;
  viewModel: ForgotPasswordViewModel;
}) {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>{viewModel.emailLabel}</Text>
        <TextInput
          autoCapitalize="none"
          inputMode="email"
          onChangeText={(text) => {
            setEmail(text);
            setResult(null);
          }}
          style={textInputStyle}
          value={email}
        />
      </View>
    </View>
  );
}

function ResultMessage({ result }: { result: RequestResetResult | null }) {
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
    <Pressable accessibilityRole="button" disabled={!canSubmit} onPress={onPress} style={primaryButtonStyle(canSubmit)}>
      <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
        {isSubmitting ? "Sending..." : label}
      </Text>
    </Pressable>
  );
}

function UnavailableMessage({
  result,
  viewModel,
}: {
  result: RequestResetResult | null;
  viewModel: ForgotPasswordViewModel;
}) {
  return result?.status === "unavailable" ? (
    <Text selectable style={{ color: colors.inkMuted, fontSize: 15, lineHeight: 22 }}>
      {viewModel.unavailableMessage}
    </Text>
  ) : null;
}

function RecoveryActions({ router, viewModel }: { router: AppRouter; viewModel: ForgotPasswordViewModel }) {
  return (
    <View style={{ gap: 10 }}>
      <SecondaryAction
        label={viewModel.recoverWithPhraseLabel}
        onPress={() => router.push("/auth/reset-password?mode=recover")}
        textColor={colors.ink}
      />
      <SecondaryAction
        label={viewModel.resetWithoutDataLabel}
        onPress={() => router.push("/auth/reset-password?mode=fresh")}
        textColor={colors.danger}
      />
    </View>
  );
}

function SecondaryAction({
  label,
  onPress,
  textColor,
}: {
  label: string;
  onPress: () => void;
  textColor: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={secondaryButtonStyle}>
      <Text style={{ color: textColor, fontSize: 17, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

async function submitForgotPasswordRequest({
  email,
  service,
  setIsSubmitting,
  setResult,
}: {
  email: string;
  service: PasswordResetService;
  setIsSubmitting: (isSubmitting: boolean) => void;
  setResult: (result: RequestResetResult | null) => void;
}) {
  setIsSubmitting(true);
  setResult(null);

  try {
    setResult(await service.requestReset(email.trim()));
  } catch (error) {
    setResult({
      message: error instanceof Error ? error.message : "Request could not be completed.",
      status: "error",
    });
  } finally {
    setIsSubmitting(false);
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

function primaryButtonStyle(canSubmit: boolean) {
  return {
    alignItems: "center" as const,
    backgroundColor: canSubmit ? colors.action : colors.inkMuted,
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
