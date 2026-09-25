import {
  initializeSslPinning,
  isSslPinningAvailable,
} from "react-native-ssl-public-key-pinning";

import { getSupabaseEnv } from "../config/supabase-env";

type Env = Partial<Record<string, string>>;

function extractDomain(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    return null;
  }
}

const runtime = globalThis as typeof globalThis & { process?: { env?: Env } };

function getSupabasePinHashes(env?: Env): string[] | null {
  const resolved = resolveEnv(env);
  const primary = resolved.EXPO_PUBLIC_SUPABASE_PIN_PRIMARY?.trim();
  const backup = resolved.EXPO_PUBLIC_SUPABASE_PIN_BACKUP?.trim();

  if (!primary || !backup) {
    return null;
  }

  return [primary, backup];
}

/**
 * Expo inlines public values only for literal `process.env.EXPO_PUBLIC_*` reads; a dynamic lookup is empty in
 * release builds, which would silently leave pinning off. The runtime environment therefore re-reads the literals.
 */
function resolveEnv(env?: Env): Env {
  if (env !== undefined && env !== runtime.process?.env) {
    return env;
  }

  return {
    ...env,
    EXPO_PUBLIC_SUPABASE_PIN_BACKUP: process.env.EXPO_PUBLIC_SUPABASE_PIN_BACKUP,
    EXPO_PUBLIC_SUPABASE_PIN_PRIMARY: process.env.EXPO_PUBLIC_SUPABASE_PIN_PRIMARY,
  };
}

/**
 * Initializes SSL public-key pinning when running in a development build
 * (EAS Build / Expo Dev Client). This is a no-op in Expo Go because the
 * native module is not available there.
 *
 * Currently pins the Supabase project domain only. The RevenueCat SDK uses
 * its own native networking stack and is NOT covered by this library;
 * RevenueCat pinning would need SDK-level configuration.
 *
 * Pin hashes are configured via EXPO_PUBLIC_SUPABASE_PIN_PRIMARY and
 * EXPO_PUBLIC_SUPABASE_PIN_BACKUP (base64-encoded SHA-256 SPKI hashes).
 * At least two pins are required per domain on iOS.
 */
export async function initializeSslPinningIfAvailable(
  env?: Env,
): Promise<void> {
  if (!isSslPinningAvailable()) {
    return;
  }

  const supabase = getSupabaseEnv(env);
  if (!supabase.isConfigured) {
    return;
  }

  const domain = extractDomain(supabase.url);
  const hashes = getSupabasePinHashes(env);

  if (!domain || !hashes) {
    return;
  }

  await initializeSslPinning({
    [domain]: {
      includeSubdomains: true,
      publicKeyHashes: hashes,
    },
  });
}
