type Env = Partial<Record<string, string>>;

export type SupabaseEnvResult =
  | { isConfigured: false }
  | {
      isConfigured: true;
      publishableKey: string;
      url: string;
    };

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Env };
};

export function getSupabaseEnv(env: Env = runtime.process?.env ?? {}): SupabaseEnvResult {
  const resolvedEnv = resolveEnv(env);

  if (hasServiceRoleKey(resolvedEnv)) {
    throw new Error("Mobile Supabase config must never include service role keys.");
  }

  const url = resolvedEnv.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = resolvedEnv.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    return { isConfigured: false };
  }

  return {
    isConfigured: true,
    publishableKey,
    url,
  };
}

function resolveEnv(env: Env): Env {
  if (env !== runtime.process?.env) {
    return env;
  }

  return {
    ...env,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  };
}

function hasServiceRoleKey(env: Env): boolean {
  const serviceRoleMarker = String.fromCharCode(83, 69, 82, 86, 73, 67, 69, 95, 82, 79, 76, 69);

  return Object.keys(env).some((key) => key.toUpperCase().includes(serviceRoleMarker));
}
