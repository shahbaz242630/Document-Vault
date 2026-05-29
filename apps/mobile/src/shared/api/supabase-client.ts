import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/shared/config/supabase-env";

type Env = Parameters<typeof getSupabaseEnv>[0];
type ClientFactory<TClient> = (url: string, publishableKey: string) => TClient;

export function createSupabaseClient(env?: Env): SupabaseClient | null;
export function createSupabaseClient<TClient>(
  env: Env,
  clientFactory: ClientFactory<TClient>,
): TClient | null;
export function createSupabaseClient<TClient>(
  env?: Env,
  clientFactory: ClientFactory<TClient> = createClient as ClientFactory<TClient>,
): TClient | null {
  const config = getSupabaseEnv(env);

  if (!config.isConfigured) {
    return null;
  }

  return clientFactory(config.url, config.publishableKey);
}
