import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import { colors } from "@/shared/theme/colors";

import { createPasswordResetService } from "../password-reset-service";
import { createForgotPasswordViewModel } from "../forgot-password-view-model";

export function ForgotPasswordPanel() {
  const viewModel = createForgotPasswordViewModel();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<
    { message: string; status: "error" | "ok" | "unavailable" } | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const service = useMemo(
    () => createPasswordResetService(createSupabaseClient()),
    [],
  );
  const router = useRouter();

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
          {viewModel.title}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          {viewModel.body}
        </Text>
      </View>

      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
            {viewModel.emailLabel}
          </Text>
          <TextInput
            autoCapitalize="none"
            inputMode="email"
            onChangeText={(text) => {
              setEmail(text);
              setResult(null);
            }}
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
            value={email}
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
        disabled={isSubmitting || email.trim().length === 0}
        onPress={async () => {
          setIsSubmitting(true);
          setResult(null);

          try {
            const nextResult = await service.requestReset(email.trim());
            setResult(nextResult);
          } catch (error) {
            setResult({
              message:
                error instanceof Error
                  ? error.message
                  : "Request could not be completed.",
              status: "error",
            });
          } finally {
            setIsSubmitting(false);
          }
        }}
        style={{
          alignItems: "center",
          backgroundColor:
            isSubmitting || email.trim().length === 0
              ? colors.inkMuted
              : colors.action,
          borderCurve: "continuous",
          borderRadius: 8,
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}
      >
        <Text
          style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}
        >
          {isSubmitting ? "Sending..." : viewModel.primaryActionLabel}
        </Text>
      </Pressable>

      {result?.status === "unavailable" ? (
        <Text
          selectable
          style={{ color: colors.inkMuted, fontSize: 15, lineHeight: 22 }}
        >
          {viewModel.unavailableMessage}
        </Text>
      ) : null}

      <View style={{ gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            router.push("/auth/reset-password?mode=recover");
          }}
          style={{
            alignItems: "center",
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderCurve: "continuous",
            borderRadius: 8,
            borderWidth: 1,
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}
        >
          <Text
            style={{
              color: colors.ink,
              fontSize: 17,
              fontWeight: "600",
            }}
          >
            {viewModel.recoverWithPhraseLabel}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            router.push("/auth/reset-password?mode=fresh");
          }}
          style={{
            alignItems: "center",
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderCurve: "continuous",
            borderRadius: 8,
            borderWidth: 1,
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}
        >
          <Text
            style={{
              color: colors.danger,
              fontSize: 17,
              fontWeight: "600",
            }}
          >
            {viewModel.resetWithoutDataLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
