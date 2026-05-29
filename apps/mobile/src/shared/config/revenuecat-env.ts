type Env = Partial<Record<string, string>>;

export type RevenueCatEnvResult =
  | { isConfigured: false }
  | { androidKey: string; iosKey: string; isConfigured: true };

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Env };
};

export function getRevenueCatEnv(
  env: Env = runtime.process?.env ?? {},
): RevenueCatEnvResult {
  const iosKey = env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim();
  const androidKey = env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim();

  if (!iosKey || !androidKey) {
    return { isConfigured: false };
  }

  return { androidKey, iosKey, isConfigured: true };
}
