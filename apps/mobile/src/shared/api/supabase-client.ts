import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/shared/config/supabase-env";

type Env = Parameters<typeof getSupabaseEnv>[0];
type ClientFactory<TClient> = (url: string, publishableKey: string) => TClient;

let cachedDefaultClient:
  | { cacheKey: string; client: SupabaseClient }
  | null = null;

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

  if (env === undefined && clientFactory === (createClient as ClientFactory<TClient>)) {
    const cacheKey = `${config.url}:${config.publishableKey}`;

    if (cachedDefaultClient?.cacheKey !== cacheKey) {
      cachedDefaultClient = {
        cacheKey,
        client: createClient(config.url, config.publishableKey),
      };
    }

    return cachedDefaultClient.client as TClient;
  }

  return clientFactory(config.url, config.publishableKey);
}
