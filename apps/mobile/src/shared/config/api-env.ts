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

export function getApiEnv(env?: Env): ApiEnvResult {
  const url = resolveEnv(env).EXPO_PUBLIC_API_URL?.trim();

  if (!url) {
    return { isConfigured: false };
  }

  return { isConfigured: true, url };
}

/**
 * Expo inlines public values only for literal `process.env.EXPO_PUBLIC_*` reads; a dynamic lookup is empty in
 * release builds. The runtime environment therefore re-reads the literal; an injected environment is used as is.
 */
function resolveEnv(env?: Env): Env {
  if (env !== undefined && env !== runtime.process?.env) {
    return env;
  }

  return {
    ...env,
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  };
}
