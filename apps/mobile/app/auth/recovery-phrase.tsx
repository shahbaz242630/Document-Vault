import { useRouter } from "expo-router";
import { lazy, Suspense, useEffect, useState } from "react";

import { useRecoveryPhraseSession } from "@/features/auth";
import { generateRandomBytes as generateSecureRandomBytes } from "@/shared/crypto/random-bytes";
import { Screen } from "@/shared/ui";

const RecoveryPhrasePanel = lazy(() =>
  import("@/features/auth/components/recovery-phrase-panel").then((m) => ({
    default: m.RecoveryPhrasePanel,
  })),
);

export default function RecoveryPhraseRoute() {
  const [entropy, setEntropy] = useState<Uint8Array | null>(null);
  const router = useRouter();
  const { setRecoveryPhraseSession } = useRecoveryPhraseSession();

  useEffect(() => {
    generateSecureRandomBytes(16).then(setEntropy);
  }, []);

  return (
    <Screen>
      {entropy ? (
        <Suspense fallback={null}>
          <RecoveryPhrasePanel
            generateRandomBytes={() => entropy}
            onContinue={(session) => {
              setRecoveryPhraseSession(session);
              router.push("/auth/confirm-recovery-phrase");
            }}
          />
        </Suspense>
      ) : null}
    </Screen>
  );
}
