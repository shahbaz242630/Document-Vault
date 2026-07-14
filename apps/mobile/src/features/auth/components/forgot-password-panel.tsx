import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import { colors } from "@/shared/theme/colors";
import {
  ErrorText,
  Field,
  MutedText,
  NoticeBox,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
  Subtitle,
  TextButton,
} from "@/shared/ui";

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
  const isSent = result?.status === "ok";

  return (
    <View style={{ flex: 1, gap: 22 }}>
      <ScreenHeader />

      <View style={{ gap: 10 }}>
        <SerifTitle>{viewModel.title}</SerifTitle>
        <Subtitle>{viewModel.body}</Subtitle>
      </View>

      {isSent ? (
        <NoticeBox title="Link sent" variant="success">
          {result?.message ?? "Check your inbox for the reset link."}
        </NoticeBox>
      ) : (
        <Field
          autoCapitalize="none"
          inputMode="email"
          label={viewModel.emailLabel}
          onChangeText={(text) => {
            setEmail(text);
            setResult(null);
          }}
          value={email}
        />
      )}

      {result?.status === "error" ? <ErrorText>{result.message}</ErrorText> : null}
      {result?.status === "unavailable" ? (
        <MutedText>{viewModel.unavailableMessage}</MutedText>
      ) : null}

      <RecoveryActions router={router} viewModel={viewModel} />

      {!isSent ? (
        <View style={{ marginTop: "auto" }}>
          <PrimaryButton
            disabled={!canSubmit}
            label={isSubmitting ? "Sending..." : viewModel.primaryActionLabel}
            onPress={() =>
              submitForgotPasswordRequest({ email, service, setIsSubmitting, setResult })
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function RecoveryActions({ router, viewModel }: { router: AppRouter; viewModel: ForgotPasswordViewModel }) {
  return (
    <View style={{ gap: 4 }}>
      <TextButton
        label={viewModel.recoverWithPhraseLabel}
        onPress={() => router.push("/auth/reset-password?mode=recover")}
      />
      <TextButton
        color={colors.danger}
        label={viewModel.resetWithoutDataLabel}
        onPress={() => router.push("/auth/reset-password?mode=fresh")}
      />
    </View>
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
