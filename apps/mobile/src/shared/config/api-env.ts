type Env = Partial<Record<string, string>>;

export type ApiEnvResult =
  | { isConfigured: false }
  | {
      isConfigured: true;
      url: string;
    };

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Env };
};

export function getApiEnv(env: Env = runtime.process?.env ?? {}): ApiEnvResult {
  const url = env.EXPO_PUBLIC_API_URL?.trim();

  if (!url) {
    return { isConfigured: false };
  }

  return { isConfigured: true, url };
}
