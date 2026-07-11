import { useRouter } from "expo-router";
import { lazy, Suspense } from "react";
import { View } from "react-native";

import {
  completeRecoveryPhraseConfirmation,
  createMekStorage,
  createMissingRecoveryPhraseSessionViewModel,
  createSignupProgressStorage,
  useRecoveryPhraseSession,
  useSignupProgressStep,
} from "@/features/auth";
import {
  createSupabaseKeyMaterialRepository,
  type SupabaseKeyMaterialClient,
} from "@/features/vault";
import { createSupabaseClient } from "@/shared/api/supabase-client";
import { deriveKEK, generateSalt } from "@/shared/crypto/kek-derivation";
import { wrapMEK } from "@/shared/crypto/mek-wrapping";
import { toBase64 } from "@/shared/crypto/vault-crypto";
import {
  PrimaryButton,
  Screen,
  ScreenHeader,
  SerifTitle,
  Subtitle,
} from "@/shared/ui";
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
    <Screen>
      {words && mek ? (
        <Suspense fallback={null}>
          <RecoveryPhraseConfirmationPanel
            words={words}
            onConfirmed={async (password) => {
              await completeRecoveryPhraseConfirmation({
                clearRecoveryPhraseSession,
                deriveKEK,
                generateSalt,
                keyMaterialRepository: createOptionalKeyMaterialRepository(),
                mek,
                mekStorage: createMekStorage(ExpoSecureStore),
                password,
                progressStorage: createSignupProgressStorage(ExpoSecureStore),
                toBase64,
                wrapMEK,
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
    </Screen>
  );
}

function createOptionalKeyMaterialRepository() {
  const client = createSupabaseClient();

  if (!client) {
    return null;
  }

  return createSupabaseKeyMaterialRepository(
    client as unknown as SupabaseKeyMaterialClient,
  );
}

function MissingRecoveryPhraseSession({ onRestart }: { onRestart: () => void }) {
  const viewModel = createMissingRecoveryPhraseSessionViewModel();

  return (
    <View style={{ flex: 1, gap: 22 }}>
      <ScreenHeader eyebrow="Recovery phrase" />

      <View style={{ gap: 10 }}>
        <SerifTitle>{viewModel.title}</SerifTitle>
        <Subtitle>{viewModel.body}</Subtitle>
      </View>

      <View style={{ marginTop: "auto" }}>
        <PrimaryButton label={viewModel.actionLabel} onPress={onRestart} />
      </View>
    </View>
  );
}
