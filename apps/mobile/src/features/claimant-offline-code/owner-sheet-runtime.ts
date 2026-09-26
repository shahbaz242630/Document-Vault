import { useMemo } from "react";
import { randomUUID } from "expo-crypto";
import { printAsync } from "expo-print";

import { createTotpVerifyService } from "@/features/auth/totp-verify-service";
import { useVaultSession } from "@/features/vault";
import { createSupabaseClient } from "@/shared/api/supabase-client";
import { getApiEnv } from "@/shared/config/api-env";

import { createOwnerOfflineCodeClient } from "./owner-offline-code-client";
import { createOwnerSheetFlow, type OwnerSheetFlow, type OwnerSheetFlowDeps } from "./owner-sheet-flow";
import { createOwnerSheetListFlow, type OwnerSheetListFlow } from "./owner-sheet-list-flow";
import { renderOwnerSheetHtml } from "./owner-sheet-html";
import { ownerSheetsOpen } from "./owner-sheet-launch";

/*
 * Slice 6H composition: the only place the owner sheet flow meets the vault session, Supabase, the API and the
 * printer. While the owner sheets are closed (owner-sheet-launch.ts) the handle is null before anything is
 * created, so the entry is hidden and the screen shows "unavailable".
 */
export { OWNER_SHEET_FLOW_LAUNCH_APPROVED } from "./owner-sheet-launch";

type Env = Partial<Record<string, string>>;
type OwnerSupabaseAuth = Readonly<{
  getSession: () => Promise<{ data: { session: { access_token: string; user: { id: string } } | null } }>;
  refreshSession: () => Promise<unknown>;
  mfa?: {
    listFactors?: () => Promise<{ data: { totp?: { id: string; status: string }[] } | null }>;
    challenge?: (input: { factorId: string }) => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
    verify?: (input: { code: string; factorId: string; challengeId: string }) =>
      Promise<{ data: unknown; error: { message: string } | null }>;
  };
}>;

export function createOwnerSheetFlowHandle(input: Readonly<{
  approved?: boolean;
  createSheet: OwnerSheetFlowDeps["createSheet"];
  auth: OwnerSupabaseAuth | null;
  env: Env;
  fetch?: typeof fetch;
  print?: (html: string) => Promise<void>;
}>): OwnerSheetFlow | null {
  if (!(input.approved ?? ownerSheetsOpen())) return null;
  const api = getApiEnv(input.env);
  const ownerOrigin = input.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN?.trim();
  const auth = input.auth;
  if (!auth || !api.isConfigured || !ownerOrigin) return null;
  const session = async () => (await auth.getSession()).data.session;
  const client = createOwnerOfflineCodeClient({ apiBaseUrl: api.url, ownerOrigin, fetch: input.fetch,
    getAccessToken: async () => (await session())?.access_token ?? null });
  return createOwnerSheetFlow({
    createSheet: input.createSheet,
    getOwnerId: async () => (await session())?.user.id ?? null,
    client,
    verifyFreshMfa: (code) => verifyFreshOwnerMfa(auth, client, code),
    renderSheetHtml: renderOwnerSheetHtml,
    print: input.print ?? (async (html) => { await printAsync({ html }); }),
    randomUUID,
  });
}

/** Slice 6J: the "My emergency sheets" list, behind the same launch approval as the sheet flow. */
export function createOwnerSheetListHandle(input: Readonly<{
  approved?: boolean;
  auth: OwnerSupabaseAuth | null;
  env: Env;
  fetch?: typeof fetch;
}>): OwnerSheetListFlow | null {
  if (!(input.approved ?? ownerSheetsOpen())) return null;
  const api = getApiEnv(input.env);
  const ownerOrigin = input.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN?.trim();
  const auth = input.auth;
  if (!auth || !api.isConfigured || !ownerOrigin) return null;
  const client = createOwnerOfflineCodeClient({ apiBaseUrl: api.url, ownerOrigin, fetch: input.fetch,
    getAccessToken: async () => (await auth.getSession()).data.session?.access_token ?? null });
  return createOwnerSheetListFlow({
    client,
    verifyFreshMfa: (code) => verifyFreshOwnerMfa(auth, client, code),
    randomUUID,
  });
}

type SessionActivator = Pick<ReturnType<typeof createOwnerOfflineCodeClient>, "activateSession">;

async function verifyFreshOwnerMfa(auth: OwnerSupabaseAuth, client: SessionActivator, code: string): Promise<boolean> {
  const factors = await auth.mfa?.listFactors?.();
  const factor = factors?.data?.totp?.find((entry) => entry.status === "verified");
  if (!factor || !/^\d{6}$/u.test(code)) return false;
  const result = await createTotpVerifyService({ auth: { mfa: auth.mfa } }).verify(factor.id, code);
  if (result.status !== "ok") return false;
  await auth.refreshSession();
  // W2a: the owner routes assert an active claimant session control; activating it needs this fresh TOTP check.
  await client.activateSession(randomUUID()).catch(() => undefined);
  return true;
}

/** The list handle for "My emergency sheets", or null while the feature is not approved. */
export function useOwnerSheetListHandle(): OwnerSheetListFlow | null {
  return useMemo(() => {
    if (!ownerSheetsOpen()) return null;
    return createOwnerSheetListHandle({
      auth: (createSupabaseClient()?.auth ?? null) as unknown as OwnerSupabaseAuth | null,
      // Literal reads so Expo inlines the public build-time values.
      env: { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
        EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN: process.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN } });
  }, []);
}

/** The flow handle for the owner's emergency sheet screen, or null while the feature is not approved. */
export function useOwnerSheetFlowHandle(): OwnerSheetFlow | null {
  const vault = useVaultSession();
  const createSheet = vault.createOfflineCodeEmergencySheet;
  return useMemo(() => {
    if (!ownerSheetsOpen()) return null;
    return createOwnerSheetFlowHandle({ createSheet,
      auth: (createSupabaseClient()?.auth ?? null) as unknown as OwnerSupabaseAuth | null,
      // Literal reads so Expo inlines the public build-time values.
      env: { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
        EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN: process.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN } });
  }, [createSheet]);
}
