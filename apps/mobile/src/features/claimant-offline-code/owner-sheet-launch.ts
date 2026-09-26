import { randomUUID } from "expo-crypto";

import { createSupabaseClient } from "@/shared/api/supabase-client";
import { getApiEnv } from "@/shared/config/api-env";
import { isClaimantPreviewBuild } from "@/shared/config/claimant-preview-build";

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

/**
 * W2a: called right after the owner's sign-in TOTP check, so the owner routes see an active session control.
 * It does nothing unless the owner sheets are open, and a failure only leaves the sheet screens unavailable.
 */
export async function activateOwnerClaimantSessionAfterMfa(): Promise<void> {
  if (!ownerSheetsOpen()) return;
  const auth = (createSupabaseClient()?.auth ?? null) as unknown as OwnerSessionAuth | null;
  const api = getApiEnv({ EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL });
  const ownerOrigin = process.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN?.trim();
  if (!auth || !api.isConfigured || !ownerOrigin) return;
  const client = createOwnerOfflineCodeClient({ apiBaseUrl: api.url, ownerOrigin,
    getAccessToken: async () => (await auth.getSession()).data.session?.access_token ?? null });
  await client.activateSession(randomUUID()).catch(() => undefined);
}
