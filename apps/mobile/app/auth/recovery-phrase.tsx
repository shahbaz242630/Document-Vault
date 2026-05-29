import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { ScrollView } from "react-native";

import { useRecoveryPhraseSession } from "@/features/auth";
import { screenStyles } from "@/shared/ui/screen";
import sodium from "libsodium-wrappers-sumo";

const RecoveryPhrasePanel = lazy(() =>
  import("@/features/auth/components/recovery-phrase-panel").then((m) => ({
    default: m.RecoveryPhrasePanel,
  })),
);

export default function RecoveryPhraseRoute() {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const { setRecoveryPhraseSession } = useRecoveryPhraseSession();

  useEffect(() => {
    sodium.ready.then(() => setIsReady(true));
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: "Recovery phrase" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        {isReady ? (
          <Suspense fallback={null}>
            <RecoveryPhrasePanel
              generateRandomBytes={(length) => sodium.randombytes_buf(length)}
              onContinue={(session) => {
                setRecoveryPhraseSession(session);
                router.push("/auth/confirm-recovery-phrase");
              }}
            />
          </Suspense>
        ) : null}
      </ScrollView>
    </>
  );
}
