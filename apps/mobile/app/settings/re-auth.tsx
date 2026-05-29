import { Stack, useRouter } from "expo-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { ScrollView } from "react-native";

import { createSignupProgressStorage } from "@/features/auth";
import { screenStyles } from "@/shared/ui/screen";
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
    <>
      <Stack.Screen options={{ title: "Verify identity" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <Suspense fallback={null}>
          <ReAuthPanel
            email={email}
            onReAuthSuccess={() => {
              router.push("/settings/delete-account");
            }}
          />
        </Suspense>
      </ScrollView>
    </>
  );
}
