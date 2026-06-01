type Env = Partial<Record<string, string>>;

export type RevenueCatEnvResult =
  | { isConfigured: false }
  | {
      androidKey?: string;
      iosKey?: string;
      sharedKey?: string;
      isConfigured: true;
    };

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Env };
};

export function getRevenueCatEnv(
  env: Env = runtime.process?.env ?? {},
): RevenueCatEnvResult {
  const sharedKey = env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim();
  const iosKey = env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim();
  const androidKey = env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim();

  if (!sharedKey && !iosKey && !androidKey) {
    return { isConfigured: false };
  }

  return {
    androidKey: androidKey || undefined,
    iosKey: iosKey || undefined,
    sharedKey: sharedKey || undefined,
    isConfigured: true,
  };
}

export function selectRevenueCatApiKey(
  env: RevenueCatEnvResult,
  platform: "android" | "ios" | string,
): string | null {
  if (!env.isConfigured) {
    return null;
  }

  if (platform === "ios") {
    return env.iosKey ?? env.sharedKey ?? null;
  }

  if (platform === "android") {
    return env.androidKey ?? env.sharedKey ?? null;
  }

  return env.sharedKey ?? env.iosKey ?? env.androidKey ?? null;
}
