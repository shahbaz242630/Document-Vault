import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import * as ExpoSecureStore from "expo-secure-store";

import {
  createSignupProgressStorage,
  getResumeRoute,
  type SignupProgress,
} from "@/features/auth/signup-progress";
import { copy } from "@/shared/i18n/en";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import { GoldHairline, PrimaryButton, Subtitle, TextButton } from "@/shared/ui";

export function WelcomePanel() {
  const [progress, setProgress] = useState<SignupProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const storage = createSignupProgressStorage(ExpoSecureStore);
      const saved = await storage.load();
      setProgress(saved);
      setIsLoading(false);
    }

    void load();
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <View style={{ flex: 1, justifyContent: "space-between" }}>
      <Wordmark />

      <View style={{ gap: 28 }}>
        <WelcomeHero />

        <View style={{ gap: 14 }}>
          {progress ? (
            <ResumeSetupActions
              onContinue={() => {
                const route = getResumeRoute(progress);
                router.replace(route as unknown as "/auth/sign-up");
              }}
              onStartOver={async () => {
                const storage = createSignupProgressStorage(ExpoSecureStore);
                await storage.clear();
                setProgress(null);
              }}
            />
          ) : (
            <PrimaryButton
              label={copy.onboarding.primaryAction}
              onPress={() =>
                router.push("/auth/trust-faq" as unknown as "/auth/sign-up")
              }
            />
          )}

          <TextButton
            label={copy.onboarding.signInLink}
            onPress={() => router.push("/auth/sign-in")}
          />
        </View>
      </View>
    </View>
  );
}

function Wordmark() {
  return (
    <View style={{ gap: 6, paddingTop: 44 }}>
      <Text
        style={{
          color: colors.action,
          fontFamily: fonts.serif.medium,
          fontSize: 22,
        }}
      >
        {copy.onboarding.wordmark}
      </Text>
      <GoldHairline />
    </View>
  );
}

function WelcomeHero() {
  return (
    <View style={{ gap: 14 }}>
      <Text
        style={{
          color: colors.ink,
          fontFamily: fonts.serif.medium,
          fontSize: 40,
          lineHeight: 45,
        }}
      >
        {copy.onboarding.title}
      </Text>
      <Subtitle style={{ fontSize: 16, lineHeight: 25 }}>
        {copy.onboarding.subtitle}
      </Subtitle>
    </View>
  );
}

function ResumeSetupActions({
  onContinue,
  onStartOver,
}: {
  onContinue: () => void;
  onStartOver: () => Promise<void>;
}) {
  return (
    <>
      <PrimaryButton label="Continue setup" onPress={onContinue} />
      <TextButton
        color={colors.danger}
        label="Start over"
        onPress={() => {
          void onStartOver();
        }}
      />
    </>
  );
}
