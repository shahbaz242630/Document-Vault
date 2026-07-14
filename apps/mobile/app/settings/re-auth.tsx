import { useRouter } from "expo-router";
import { lazy, Suspense, useEffect, useState } from "react";

import { createSignupProgressStorage } from "@/features/auth";
import { Screen } from "@/shared/ui";
import * as ExpoSecureStore from "expo-secure-store";

const ReAuthPanel = lazy(() =>
  import("@/features/auth/components/re-auth-panel").then((m) => ({
    default: m.ReAuthPanel,
  })),
);

export default function ReAuthRoute() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    async function loadEmail() {
      const storage = createSignupProgressStorage(ExpoSecureStore);
      const progress = await storage.load();
      if (progress) {
        setEmail(progress.email);
      }
    }
    void loadEmail();
  }, []);

  return (
    <Screen>
      <Suspense fallback={null}>
        <ReAuthPanel
          email={email}
          onReAuthSuccess={() => {
            router.push("/settings/delete-account");
          }}
        />
      </Suspense>
    </Screen>
  );
}
