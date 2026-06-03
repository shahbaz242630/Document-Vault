import { useMemo, useState } from "react";
import { useRouter, type Router } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";

import {
  createSupabaseKeyMaterialRepository,
  type SupabaseKeyMaterialClient,
  type SupabaseVaultClient,
  useVaultSession,
} from "@/features/vault";
import { createSupabaseClient } from "@/shared/api/supabase-client";
import { deriveKEK } from "@/shared/crypto/kek-derivation";
import { unwrapMEK } from "@/shared/crypto/mek-wrapping";
import { toBase64 } from "@/shared/crypto/vault-crypto";
import { colors } from "@/shared/theme/colors";
import * as ExpoSecureStore from "expo-secure-store";

import { defaultAuditLog } from "../audit-log";
import { createAuthService, type AuthServiceResult } from "../auth-service";
import type { AuthCredentialsInput } from "../auth-credentials";
import { configureDurableAuditLog } from "../durable-audit-log";
import { createFailedLoginTracker } from "../failed-login-tracker";
import { createLoginLockoutViewModel } from "../login-lockout-view-model";
import { createMekStorage } from "../mek-storage";
import { unlockReturningUserVault } from "../returning-user-unlock-flow";
import { createSignupProgressStorage } from "../signup-progress";
import type { SupabaseAuditClient } from "../supabase-audit-event-repository";

type EmailPasswordAuthFormProps = {
  mode: "sign-in" | "sign-up";
};

type AuthService = ReturnType<typeof createAuthService>;
type FailedLoginTracker = ReturnType<typeof createFailedLoginTracker>;
type VaultSession = ReturnType<typeof useVaultSession>;
type SupabaseClient = ReturnType<typeof createSupabaseClient>;

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
  const supabaseClient = useMemo(() => createSupabaseClient(), []);
  const authService = useMemo(() => createAuthService(supabaseClient), [supabaseClient]);
  const lockoutTracker = useMemo(() => createFailedLoginTracker(), []);
  const router = useRouter();
  const vaultSession = useVaultSession();
  const screenCopy = content[mode];
  const isLocked = mode === "sign-in" && lockoutTracker.isLocked(values.email);

  return (
    <View style={{ gap: 20 }}>
      <AuthFormHeader subtitle={screenCopy.subtitle} title={screenCopy.title} />
      <CredentialsFields onChange={setValues} setResult={setResult} values={values} />
      <AuthResultMessage result={result} />
      <ForgotPasswordLink mode={mode} router={router} />
      <SubmitButton
        disabled={isSubmitting || isLocked}
        isSubmitting={isSubmitting}
        label={screenCopy.action}
        onPress={() =>
          submitAuthForm({
            authService,
            lockoutTracker,
            mode,
            router,
            setIsSubmitting,
            setResult,
            supabaseClient,
            values,
            vaultSession,
          })
        }
      />
    </View>
  );
}

function AuthFormHeader({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Account security</Text>
      <Text style={{ color: colors.ink, fontSize: 30, fontWeight: "700", lineHeight: 36 }}>{title}</Text>
      <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>{subtitle}</Text>
    </View>
  );
}

function CredentialsFields({
  onChange,
  setResult,
  values,
}: {
  onChange: (updater: (current: AuthCredentialsInput) => AuthCredentialsInput) => void;
  setResult: (result: AuthServiceResult | null) => void;
  values: AuthCredentialsInput;
}) {
  return (
    <View style={{ gap: 14 }}>
      <AuthTextInput
        autoCapitalize="none"
        inputMode="email"
        label="Email"
        onChangeText={(email) => updateCredentials(onChange, setResult, "email", email)}
        value={values.email}
      />
      <AuthTextInput
        label="Password"
        onChangeText={(password) => updateCredentials(onChange, setResult, "password", password)}
        secureTextEntry
        value={values.password}
      />
      <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Use at least 12 characters.</Text>
    </View>
  );
}

function AuthResultMessage({ result }: { result: AuthServiceResult | null }) {
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

function ForgotPasswordLink({ mode, router }: { mode: EmailPasswordAuthFormProps["mode"]; router: Router }) {
  return mode === "sign-in" ? (
    <Pressable accessibilityRole="button" onPress={() => router.push("/auth/forgot-password")}>
      <Text style={{ color: colors.action, fontSize: 15, textAlign: "center" }}>Forgot password?</Text>
    </Pressable>
  ) : null;
}

function SubmitButton({
  disabled,
  isSubmitting,
  label,
  onPress,
}: {
  disabled: boolean;
  isSubmitting: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={buttonStyle(isSubmitting)}>
      <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
        {isSubmitting ? "Working..." : label}
      </Text>
    </Pressable>
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
        style={textInputStyle}
        value={value}
      />
    </View>
  );
}

function updateCredentials(
  setValues: (updater: (current: AuthCredentialsInput) => AuthCredentialsInput) => void,
  setResult: (result: AuthServiceResult | null) => void,
  field: keyof AuthCredentialsInput,
  value: string,
) {
  setValues((current) => ({ ...current, [field]: value }));
  setResult(null);
}

async function submitAuthForm({
  authService,
  lockoutTracker,
  mode,
  router,
  setIsSubmitting,
  setResult,
  supabaseClient,
  values,
  vaultSession,
}: {
  authService: AuthService;
  lockoutTracker: FailedLoginTracker;
  mode: EmailPasswordAuthFormProps["mode"];
  router: Router;
  setIsSubmitting: (value: boolean) => void;
  setResult: (result: AuthServiceResult | null) => void;
  supabaseClient: SupabaseClient;
  values: AuthCredentialsInput;
  vaultSession: VaultSession;
}) {
  setIsSubmitting(true);
  setResult(null);

  try {
    await recordAuthAttempt({ lockoutTracker, mode, setIsSubmitting, setResult, values });
    const nextResult = await runAuthRequest({ authService, mode, values });
    setResult(nextResult);
    await handleAuthResult({ lockoutTracker, mode, nextResult, router, supabaseClient, values, vaultSession });
  } catch (error) {
    if (error instanceof AuthFlowStoppedError) {
      return;
    }
    setResult({
      message: error instanceof Error ? error.message : "This request could not be completed.",
      status: "error",
    });
  } finally {
    setIsSubmitting(false);
  }
}

async function recordAuthAttempt({
  lockoutTracker,
  mode,
  setIsSubmitting,
  setResult,
  values,
}: {
  lockoutTracker: FailedLoginTracker;
  mode: EmailPasswordAuthFormProps["mode"];
  setIsSubmitting: (value: boolean) => void;
  setResult: (result: AuthServiceResult | null) => void;
  values: AuthCredentialsInput;
}) {
  logAuthEvent(mode === "sign-in" ? "sign_in_attempt" : "sign_up_attempt", values.email);
  if (mode !== "sign-in") {
    return;
  }

  const remainingMs = lockoutTracker.getRemainingLockoutMs(values.email);
  if (remainingMs <= 0) {
    return;
  }

  setResult({ message: createLoginLockoutViewModel(remainingMs).message, status: "error" });
  setIsSubmitting(false);
  throw new AuthFlowStoppedError();
}

async function runAuthRequest({
  authService,
  mode,
  values,
}: {
  authService: AuthService;
  mode: EmailPasswordAuthFormProps["mode"];
  values: AuthCredentialsInput;
}) {
  return mode === "sign-up" ? authService.signUp(values) : authService.signIn(values);
}

async function handleAuthResult({
  lockoutTracker,
  mode,
  nextResult,
  router,
  supabaseClient,
  values,
  vaultSession,
}: {
  lockoutTracker: FailedLoginTracker;
  mode: EmailPasswordAuthFormProps["mode"];
  nextResult: AuthServiceResult;
  router: Router;
  supabaseClient: SupabaseClient;
  values: AuthCredentialsInput;
  vaultSession: VaultSession;
}) {
  if (nextResult.status === "error") {
    recordAuthFailure({ lockoutTracker, mode, values });
    return;
  }
  if (nextResult.status !== "ok") {
    return;
  }

  configureDurableAuditLog({
    auditLog: defaultAuditLog,
    client: supabaseClient as unknown as SupabaseAuditClient,
  });
  logAuthEvent(mode === "sign-in" ? "sign_in_success" : "sign_up_success", values.email);
  await routeAfterAuthSuccess({ nextResult, router, supabaseClient, values, vaultSession });
}

function recordAuthFailure({
  lockoutTracker,
  mode,
  values,
}: {
  lockoutTracker: FailedLoginTracker;
  mode: EmailPasswordAuthFormProps["mode"];
  values: AuthCredentialsInput;
}) {
  if (mode !== "sign-in") {
    return;
  }

  lockoutTracker.recordFailure(values.email);
  defaultAuditLog.log({
    deviceInfo: "React Native",
    eventType: "sign_in_failure",
    metadata: { lockoutRemainingMs: lockoutTracker.getRemainingLockoutMs(values.email) },
    userEmail: values.email,
  });
}

async function routeAfterAuthSuccess({
  nextResult,
  router,
  supabaseClient,
  values,
  vaultSession,
}: {
  nextResult: Extract<AuthServiceResult, { status: "ok" }>;
  router: Router;
  supabaseClient: SupabaseClient;
  values: AuthCredentialsInput;
  vaultSession: VaultSession;
}) {
  if (nextResult.nextStep === "email-verification") {
    await routeToEmailVerification(router, values.email);
  } else if (nextResult.nextStep === "totp-verification") {
    router.push({ pathname: "/auth/verify-totp", params: { factorId: "" } });
  } else if (nextResult.nextStep === "vault-unlock") {
    await routeToUnlockedVault({ router, supabaseClient, values, vaultSession });
  }
}

async function routeToEmailVerification(router: Router, email: string) {
  await createSignupProgressStorage(ExpoSecureStore).save({
    email,
    step: "verify-email",
  });
  router.push({ pathname: "/auth/verify-email", params: { email } });
}

async function routeToUnlockedVault({
  router,
  supabaseClient,
  values,
  vaultSession,
}: {
  router: Router;
  supabaseClient: SupabaseClient;
  values: AuthCredentialsInput;
  vaultSession: VaultSession;
}) {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured yet.");
  }

  await unlockReturningUserVault({
    deriveKEK,
    initializeVault: (keyBase64) =>
      vaultSession.initialize(keyBase64, supabaseClient as unknown as SupabaseVaultClient),
    keyMaterialRepository: createSupabaseKeyMaterialRepository(
      supabaseClient as unknown as SupabaseKeyMaterialClient,
    ),
    mekStorage: createMekStorage(ExpoSecureStore),
    password: values.password,
    toBase64,
    unwrapMEK,
  });
  router.replace("/vault");
}

function logAuthEvent(eventType: "sign_in_attempt" | "sign_up_attempt" | "sign_in_success" | "sign_up_success", email: string) {
  defaultAuditLog.log({
    deviceInfo: "React Native",
    eventType,
    userEmail: email,
  });
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

function buttonStyle(isSubmitting: boolean) {
  return {
    alignItems: "center" as const,
    backgroundColor: isSubmitting ? colors.inkMuted : colors.action,
    borderCurve: "continuous" as const,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
  };
}

class AuthFlowStoppedError extends Error {}
