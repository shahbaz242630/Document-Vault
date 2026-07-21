import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireWebSupabaseConfig } from "./config";

export async function createWebServerClient() {
  const config = requireWebSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The request proxy refreshes them.
        }
      },
    },
  });
}
