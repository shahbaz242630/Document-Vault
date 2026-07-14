import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import * as ExpoSecureStore from "expo-secure-store";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import {
  BodyText,
  CodeField,
  ErrorText,
  MutedText,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
  StepHeader,
  Subtitle,
} from "@/shared/ui";

import { createTotpVerifyService, type TotpVerifyServiceResult } from "../totp-verify-service";
import {
  createTotpVerifyViewModel,
  type TotpVerifyVariant,
} from "../totp-verify-view-model";
import { createSignupProgressStorage } from "../signup-progress";

type TotpVerifyPanelProps = {
  factorId: string;
  variant?: TotpVerifyVariant;
};

export function TotpVerifyPanel({ factorId, variant = "onboarding" }: TotpVerifyPanelProps) {
  const viewModel = createTotpVerifyViewModel(variant);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<TotpVerifyServiceResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const verifyService = useMemo(() => createTotpVerifyService(createSupabaseClient()), []);
  const router = useRouter();

  return (
    <View style={{ flex: 1, gap: 22 }}>
      {variant === "onboarding" ? (
        <StepHeader step="security-3" />
      ) : (
        <ScreenHeader />
      )}

      <View style={{ gap: 10 }}>
        <SerifTitle>{viewModel.title}</SerifTitle>
        <Subtitle>{viewModel.body}</Subtitle>
      </View>

      <View style={{ gap: 12 }}>
        <CodeField
          onChangeText={(text) => {
            setCode(text);
            setResult(null);
          }}
          value={code}
        />
        <TotpResultMessage result={result} />
        {variant === "returning" ? (
          <MutedText style={{ textAlign: "center" }}>
            Lost your app? Use a backup code instead.
          </MutedText>
        ) : null}
      </View>

      <View style={{ marginTop: "auto" }}>
        <PrimaryButton
          disabled={isSubmitting || code.length < 6}
          label={isSubmitting ? "Verifying..." : viewModel.primaryActionLabel}
          onPress={() => {
            void submitTotpCode();
          }}
        />
      </View>
    </View>
  );

  async function submitTotpCode() {
    setIsSubmitting(true);

    try {
      const nextResult = await verifyService.verify(factorId, code);
      setResult(nextResult);

      if (nextResult.status === "ok") {
        const progressStorage = createSignupProgressStorage(ExpoSecureStore);
        const existing = await progressStorage.load();
        if (existing) {
          await progressStorage.save({ ...existing, step: "recovery-phrase" });
        }
        router.replace("/auth/recovery-phrase");
      }
    } catch (error) {
      setResult({
        message: error instanceof Error ? error.message : "This request could not be completed.",
        status: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
}

function TotpResultMessage({
  result,
}: {
  result: TotpVerifyServiceResult | null;
}) {
  if (!result) return null;

  return result.status === "error" ? (
    <ErrorText>{result.message}</ErrorText>
  ) : (
    <BodyText>{result.message}</BodyText>
  );
}
