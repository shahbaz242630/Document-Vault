import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import { colors } from "@/shared/theme/colors";
import * as ExpoSecureStore from "expo-secure-store";

import { createTotpVerifyService, type TotpVerifyServiceResult } from "../totp-verify-service";
import { createTotpVerifyViewModel } from "../totp-verify-view-model";
import { createSignupProgressStorage } from "../signup-progress";

type TotpVerifyPanelProps = {
  factorId: string;
};

export function TotpVerifyPanel({ factorId }: TotpVerifyPanelProps) {
  const viewModel = createTotpVerifyViewModel();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<TotpVerifyServiceResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const verifyService = useMemo(() => createTotpVerifyService(createSupabaseClient()), []);
  const router = useRouter();

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
          {viewModel.statusLabel}
        </Text>
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
          {viewModel.body}
        </Text>
      </View>

      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
            {viewModel.codeInputLabel}
          </Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(text) => {
              setCode(text);
              setResult(null);
            }}
            placeholder="000000"
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
            value={code}
          />
        </View>
      </View>

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
        disabled={isSubmitting || code.length < 6}
        onPress={async () => {
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
        }}
        style={{
          alignItems: "center",
          backgroundColor: isSubmitting || code.length < 6 ? colors.inkMuted : colors.action,
          borderCurve: "continuous",
          borderRadius: 8,
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
          {isSubmitting ? "Verifying..." : viewModel.primaryActionLabel}
        </Text>
      </Pressable>
    </View>
  );
}
