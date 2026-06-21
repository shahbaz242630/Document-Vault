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
  if (hasServiceRoleKey(env)) {
    throw new Error("Mobile Supabase config must never include service role keys.");
  }

  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    return { isConfigured: false };
  }

  return {
    isConfigured: true,
    publishableKey,
    url,
  };
}

function hasServiceRoleKey(env: Env): boolean {
  const serviceRoleMarker = String.fromCharCode(83, 69, 82, 86, 73, 67, 69, 95, 82, 79, 76, 69);

  return Object.keys(env).some((key) => key.toUpperCase().includes(serviceRoleMarker));
}
