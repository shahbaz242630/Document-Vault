import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import { colors } from "@/shared/theme/colors";
import * as ExpoSecureStore from "expo-secure-store";

import { defaultAuditLog } from "../audit-log";
import { createAuthService, type AuthServiceResult } from "../auth-service";
import type { AuthCredentialsInput } from "../auth-credentials";
import { createFailedLoginTracker } from "../failed-login-tracker";
import { createLoginLockoutViewModel } from "../login-lockout-view-model";
import { createSignupProgressStorage } from "../signup-progress";

type EmailPasswordAuthFormProps = {
  mode: "sign-in" | "sign-up";
};

const initialValues: AuthCredentialsInput = {
  email: "",
  password: "",
};

const content = {
  "sign-in": {
    action: "Continue",
    subtitle: "Use your email and password. Two-factor verification comes next.",
    title: "Sign in",
  },
  "sign-up": {
    action: "Create account",
    subtitle: "Start with email and a strong password. Two-factor setup is required next.",
    title: "Create your vault",
  },
} as const;

export function EmailPasswordAuthForm({ mode }: EmailPasswordAuthFormProps) {
  const [values, setValues] = useState<AuthCredentialsInput>(initialValues);
  const [result, setResult] = useState<AuthServiceResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const authService = useMemo(() => createAuthService(createSupabaseClient()), []);
  const lockoutTracker = useMemo(() => createFailedLoginTracker(), []);
  const router = useRouter();
  const screenCopy = content[mode];

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Account security</Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: 30,
            fontWeight: "700",
            lineHeight: 36,
          }}
        >
          {screenCopy.title}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          {screenCopy.subtitle}
        </Text>
      </View>

      <View style={{ gap: 14 }}>
        <AuthTextInput
          autoCapitalize="none"
          inputMode="email"
          label="Email"
          onChangeText={(email) => {
            setValues((current) => ({ ...current, email }));
            setResult(null);
          }}
          value={values.email}
        />
        <AuthTextInput
          label="Password"
          onChangeText={(password) => {
            setValues((current) => ({ ...current, password }));
            setResult(null);
          }}
          secureTextEntry
          value={values.password}
        />
        <Text style={{ color: colors.inkMuted, fontSize: 13 }}>
          Use at least 12 characters.
        </Text>
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

      {mode === "sign-in" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            router.push("/auth/forgot-password");
          }}
        >
          <Text style={{ color: colors.action, fontSize: 15, textAlign: "center" }}>
            Forgot password?
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting || (mode === "sign-in" && lockoutTracker.isLocked(values.email))}
        onPress={async () => {
          setIsSubmitting(true);
          setResult(null);

          try {
            if (mode === "sign-in") {
              defaultAuditLog.log({
                deviceInfo: "React Native",
                eventType: "sign_in_attempt",
                userEmail: values.email,
              });

              const remainingMs = lockoutTracker.getRemainingLockoutMs(values.email);

              if (remainingMs > 0) {
                const lockoutVm = createLoginLockoutViewModel(remainingMs);
                setResult({
                  message: lockoutVm.message,
                  status: "error",
                });
                setIsSubmitting(false);
                return;
              }
            } else {
              defaultAuditLog.log({
                deviceInfo: "React Native",
                eventType: "sign_up_attempt",
                userEmail: values.email,
              });
            }

            const nextResult =
              mode === "sign-up"
                ? await authService.signUp(values)
                : await authService.signIn(values);

            setResult(nextResult);

            if (nextResult.status === "error" && mode === "sign-in") {
              lockoutTracker.recordFailure(values.email);
              defaultAuditLog.log({
                deviceInfo: "React Native",
                eventType: "sign_in_failure",
                metadata: { lockoutRemainingMs: lockoutTracker.getRemainingLockoutMs(values.email) },
                userEmail: values.email,
              });
            }

            if (nextResult.status === "ok") {
              if (mode === "sign-in") {
                defaultAuditLog.log({
                  deviceInfo: "React Native",
                  eventType: "sign_in_success",
                  userEmail: values.email,
                });
              } else {
                defaultAuditLog.log({
                  deviceInfo: "React Native",
                  eventType: "sign_up_success",
                  userEmail: values.email,
                });
              }

              if (nextResult.nextStep === "email-verification") {
                const progressStorage = createSignupProgressStorage(ExpoSecureStore);
                await progressStorage.save({
                  email: values.email,
                  step: "verify-email",
                });
                router.push({
                  pathname: "/auth/verify-email",
                  params: { email: values.email },
                });
              } else if (nextResult.nextStep === "totp-verification") {
                router.push({
                  pathname: "/auth/verify-totp",
                  params: { factorId: "" },
                });
              }
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
          backgroundColor: isSubmitting ? colors.inkMuted : colors.action,
          borderCurve: "continuous",
          borderRadius: 8,
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
          {isSubmitting ? "Working..." : screenCopy.action}
        </Text>
      </Pressable>
    </View>
  );
}

type AuthTextInputProps = {
  autoCapitalize?: "none";
  inputMode?: "email";
  label: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  value: string;
};

function AuthTextInput({
  autoCapitalize,
  inputMode,
  label,
  onChangeText,
  secureTextEntry,
  value,
}: AuthTextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        inputMode={inputMode}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
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
