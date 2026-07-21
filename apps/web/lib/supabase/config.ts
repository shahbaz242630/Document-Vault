const SUPABASE_URL = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_KEY = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

function getBundledPublicEnv(): Record<string, string | undefined> {
  // Next.js only replaces statically referenced NEXT_PUBLIC_* variables in the
  // browser bundle. Keep these property accesses explicit rather than reading
  // process.env through a computed key.
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export type WebSupabaseConfig = {
  publishableKey: string;
  url: string;
};

export function getWebSupabaseConfig(
  env: Record<string, string | undefined> = getBundledPublicEnv(),
): WebSupabaseConfig | null {
  const url = env[SUPABASE_URL]?.trim();
  const publishableKey = env[SUPABASE_KEY]?.trim();

  if (!url || !publishableKey) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`${SUPABASE_URL} must be a valid URL.`);
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
    throw new Error(`${SUPABASE_URL} must use HTTPS outside localhost.`);
  }

  return { publishableKey, url: parsedUrl.toString().replace(/\/$/u, "") };
}

export function requireWebSupabaseConfig(): WebSupabaseConfig {
  const config = getWebSupabaseConfig();
  if (!config) throw new Error("Sanduqkin web authentication is not configured.");
  return config;
}
