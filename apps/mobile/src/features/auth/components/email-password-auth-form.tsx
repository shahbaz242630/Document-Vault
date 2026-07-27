import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";

import {
  createSupabaseKeyMaterialRepository,
  type SupabaseKeyMaterialClient,
} from "@/features/vault/supabase-key-material-repository";
import type { SupabaseVaultClient } from "@/features/vault/supabase-vault-repository";
import { useVaultSession } from "@/features/vault/vault-session-context";
import { createSupabaseClient } from "@/shared/api/supabase-client";
import {
  BodyText,
  ErrorText,
  Field,
  NoticeBox,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
  StepHeader,
  Subtitle,
  TextButton,
} from "@/shared/ui";
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
type AppRouter = ReturnType<typeof useRouter>;
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
    subtitle: "Your email and password first — your second lock comes next.",
    title: "Welcome back",
  },
  "sign-up": {
    action: "Continue",
    subtitle:
      "Start with your email and a strong password. Your password becomes part of the key that seals your vault.",
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

  const submit = () =>
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
    });

  return (
    <View style={{ flex: 1, gap: 22 }}>
      {mode === "sign-up" ? <StepHeader step="account-1" /> : <ScreenHeader />}

      <View style={{ gap: 10 }}>
        <SerifTitle>{screenCopy.title}</SerifTitle>
        <Subtitle>{screenCopy.subtitle}</Subtitle>
      </View>

      <View style={{ gap: 14 }}>
        <Field
          accessibilityLabel={`${mode === "sign-in" ? "Sign-in" : "Sign-up"} email`}
          autoCapitalize="none"
          inputMode="email"
          label="Email"
          onChangeText={(email) => updateCredentials(setValues, setResult, "email", email)}
          value={values.email}
        />
        <Field
          accessibilityLabel={`${mode === "sign-in" ? "Sign-in" : "Sign-up"} password`}
          hint={
            mode === "sign-up"
              ? "At least 12 characters. Longer is stronger — a short sentence works well."
              : undefined
          }
          label="Password"
          onChangeText={(password) => updateCredentials(setValues, setResult, "password", password)}
          secureTextEntry
          value={values.password}
        />
        <AuthResultMessage result={result} />
        {isLocked ? (
          <NoticeBox title="Too many attempts" variant="danger">
            For your safety, sign-in is paused for a few minutes. This slows
            anyone trying to guess their way in.
          </NoticeBox>
        ) : null}
        {mode === "sign-in" ? (
          <TextButton
            label="Forgot password?"
            onPress={() => router.push("/auth/forgot-password")}
          />
        ) : null}
      </View>

      <View style={{ gap: 14, marginTop: "auto" }}>
        <PrimaryButton
          disabled={isSubmitting || isLocked}
          label={isSubmitting ? "Working..." : screenCopy.action}
          onPress={submit}
        />
        {mode === "sign-up" ? (
          <TextButton
            label="I already have an account"
            onPress={() => router.replace("/auth/sign-in")}
          />
        ) : null}
      </View>
    </View>
  );
}

function AuthResultMessage({ result }: { result: AuthServiceResult | null }) {
  if (!result) {
    return null;
  }
  return result.status === "error" ? (
    <ErrorText>{result.message}</ErrorText>
  ) : (
    <BodyText>{result.message}</BodyText>
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
  router: AppRouter;
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
  router: AppRouter;
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
  router: AppRouter;
  supabaseClient: SupabaseClient;
  values: AuthCredentialsInput;
  vaultSession: VaultSession;
}) {
  if (nextResult.nextStep === "email-verification") {
    await routeToEmailVerification(router, values.email);
  } else if (nextResult.nextStep === "totp-verification") {
    router.push({
      pathname: "/auth/verify-totp",
      params: { factorId: "", flow: "returning" },
    });
  } else if (nextResult.nextStep === "vault-unlock") {
    await routeToUnlockedVault({ router, supabaseClient, values, vaultSession });
  }
}

async function routeToEmailVerification(router: AppRouter, email: string) {
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
  router: AppRouter;
  supabaseClient: SupabaseClient;
  values: AuthCredentialsInput;
  vaultSession: VaultSession;
}) {
  if (!supabaseClient) {
    throw new Error("Supabase is not configured yet.");
  }

  const [{ deriveKEK }, { unwrapMEK }, { toBase64 }] = await Promise.all([
    import("@/shared/crypto/kek-derivation"),
    import("@/shared/crypto/mek-wrapping"),
    import("@/shared/crypto/vault-crypto"),
  ]);

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

class AuthFlowStoppedError extends Error {}
