import { randomUUID } from "expo-crypto";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import { getApiEnv } from "@/shared/config/api-env";
import { isClaimantPreviewBuild } from "@/shared/config/claimant-preview-build";
import { withClaimantPreviewBypass } from "@/shared/config/claimant-preview-fetch";

import { createOwnerOfflineCodeClient } from "./owner-offline-code-client";

/*
 * Slice 6H launch approval, and since W2a the only other way in: the separate Sanduqkin Preview app. Kept apart
 * from the sheet runtime so the sign-in screen can activate the owner session without loading the vault or printer.
 */
export const OWNER_SHEET_FLOW_LAUNCH_APPROVED = false as const;

export function ownerSheetsOpen(): boolean {
  return OWNER_SHEET_FLOW_LAUNCH_APPROVED || isClaimantPreviewBuild();
}

type OwnerSessionAuth = Readonly<{
  getSession: () => Promise<{ data: { session: { access_token: string } | null } }>;
}>;

export type OwnerSessionActivation = "activated" | "not_configured" | "failed";

/**
 * W2a: called right after every successful owner TOTP check (sign-in, enrolment and step-up), so the owner routes
 * see an active session control. It does nothing unless the owner sheets are open, and a failure only leaves the
 * sheet screens asking for a step-up.
 */
export async function activateOwnerClaimantSessionAfterMfa(): Promise<OwnerSessionActivation | undefined> {
  if (!ownerSheetsOpen()) return;
  return activateOwnerClaimantSession({
    auth: (createSupabaseClient()?.auth ?? null) as unknown as OwnerSessionAuth | null,
    // Literal reads so Expo inlines the public build-time values.
    env: { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN: process.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN },
    fetch: withClaimantPreviewBypass(fetch), randomUUID });
}

/** The activation itself. The token is read when the request is made, so it is the session the TOTP check raised. */
export async function activateOwnerClaimantSession(input: Readonly<{
  auth: OwnerSessionAuth | null;
  env: Partial<Record<string, string>>;
  fetch: typeof fetch;
  randomUUID: () => string;
}>): Promise<OwnerSessionActivation> {
  const api = getApiEnv(input.env);
  const ownerOrigin = input.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN?.trim();
  const auth = input.auth;
  if (!auth || !api.isConfigured || !ownerOrigin) return "not_configured";
  const client = createOwnerOfflineCodeClient({ apiBaseUrl: api.url, ownerOrigin, fetch: input.fetch,
    getAccessToken: async () => (await auth.getSession()).data.session?.access_token ?? null });
  return client.activateSession(input.randomUUID()).then(() => "activated" as const, () => "failed" as const);
}
