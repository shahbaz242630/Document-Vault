import { Stack, useRouter } from "expo-router";
import { lazy, Suspense } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  completeRecoveryPhraseConfirmation,
  createMekStorage,
  createMissingRecoveryPhraseSessionViewModel,
  createSignupProgressStorage,
  useRecoveryPhraseSession,
  useSignupProgressStep,
} from "@/features/auth";
import { toBase64 } from "@/shared/crypto/vault-crypto";
import { colors } from "@/shared/theme/colors";
import { screenStyles } from "@/shared/ui/screen";
import * as ExpoSecureStore from "expo-secure-store";

const RecoveryPhraseConfirmationPanel = lazy(() =>
  import("@/features/auth/components/recovery-phrase-confirmation-panel").then(
    (m) => ({ default: m.RecoveryPhraseConfirmationPanel }),
  ),
);

export default function ConfirmRecoveryPhraseRoute() {
  useSignupProgressStep("confirm-recovery-phrase", ExpoSecureStore);
  const router = useRouter();
  const { clearRecoveryPhraseSession, mek, words } = useRecoveryPhraseSession();

  return (
    <>
      <Stack.Screen options={{ title: "Confirm phrase" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        {words && mek ? (
          <Suspense fallback={null}>
            <RecoveryPhraseConfirmationPanel
              words={words}
              onConfirmed={async () => {
                await completeRecoveryPhraseConfirmation({
                  clearRecoveryPhraseSession,
                  mek,
                  mekStorage: createMekStorage(ExpoSecureStore),
                  progressStorage: createSignupProgressStorage(ExpoSecureStore),
                  toBase64,
                });
                router.replace("/auth/setup-biometric");
              }}
            />
          </Suspense>
        ) : (
          <MissingRecoveryPhraseSession
            onRestart={() => {
              clearRecoveryPhraseSession();
              router.replace("/auth/recovery-phrase");
            }}
          />
        )}
      </ScrollView>
    </>
  );
}

function MissingRecoveryPhraseSession({ onRestart }: { onRestart: () => void }) {
  const viewModel = createMissingRecoveryPhraseSessionViewModel();

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
          Recovery phrase
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

      <Pressable
        accessibilityRole="button"
        onPress={onRestart}
        style={{
          alignItems: "center",
          backgroundColor: colors.action,
          borderCurve: "continuous",
          borderRadius: 8,
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
          {viewModel.actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}
