import { createBrowserClient } from "@supabase/ssr";

import { requireWebSupabaseConfig } from "./config";

export function createWebBrowserClient() {
  const config = requireWebSupabaseConfig();
  return createBrowserClient(config.url, config.publishableKey);
}
