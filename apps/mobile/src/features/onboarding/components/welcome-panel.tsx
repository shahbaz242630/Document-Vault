import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import {
  createSignupProgressStorage,
  getResumeRoute,
  type SignupProgress,
} from "@/features/auth";
import { copy } from "@/shared/i18n/en";
import { colors } from "@/shared/theme/colors";
import * as ExpoSecureStore from "expo-secure-store";

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
    <View style={{ gap: 24 }}>
      <View style={{ gap: 10 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
          {copy.onboarding.eyebrow}
        </Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: 34,
            fontWeight: "700",
            lineHeight: 40,
          }}
        >
          {copy.onboarding.title}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          {copy.onboarding.subtitle}
        </Text>
      </View>

      {progress ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const route = getResumeRoute(progress);
              router.replace(route as unknown as "/auth/sign-up");
            }}
            style={{
              alignItems: "center",
              backgroundColor: colors.action,
              borderCurve: "continuous",
              borderRadius: 8,
              paddingHorizontal: 18,
              paddingVertical: 14,
            }}
          >
            <Text
              style={{
                color: colors.actionText,
                fontSize: 17,
                fontWeight: "700",
              }}
            >
              Continue setup
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              const storage = createSignupProgressStorage(ExpoSecureStore);
              await storage.clear();
              setProgress(null);
            }}
            style={{ alignItems: "center", paddingVertical: 8 }}
          >
            <Text
              style={{ color: colors.danger, fontSize: 15, textAlign: "center" }}
            >
              Start over
            </Text>
          </Pressable>
        </>
      ) : (
        <Link href="/auth/sign-up" asChild>
          <Pressable
            accessibilityRole="button"
            style={{
              alignItems: "center",
              backgroundColor: colors.action,
              borderCurve: "continuous",
              borderRadius: 8,
              paddingHorizontal: 18,
              paddingVertical: 14,
            }}
          >
            <Text
              style={{
                color: colors.actionText,
                fontSize: 17,
                fontWeight: "700",
              }}
            >
              {copy.onboarding.primaryAction}
            </Text>
          </Pressable>
        </Link>
      )}

      <Link href="/auth/sign-in" style={{ color: colors.inkMuted, fontSize: 15 }}>
        I already have an account
      </Link>
    </View>
  );
}
