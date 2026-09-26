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

/*
 * Slice 6H composition: the only place the owner sheet flow meets the vault session, Supabase, the API and the
 * printer. While OWNER_SHEET_FLOW_LAUNCH_APPROVED is false the handle is null before anything is created, so the
 * entry is hidden and the screen shows "unavailable".
 */
export const OWNER_SHEET_FLOW_LAUNCH_APPROVED = false as const;

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
  if (!(input.approved ?? OWNER_SHEET_FLOW_LAUNCH_APPROVED)) return null;
  const api = getApiEnv(input.env);
  const ownerOrigin = input.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN?.trim();
  const auth = input.auth;
  if (!auth || !api.isConfigured || !ownerOrigin) return null;
  const session = async () => (await auth.getSession()).data.session;
  return createOwnerSheetFlow({
    createSheet: input.createSheet,
    getOwnerId: async () => (await session())?.user.id ?? null,
    client: createOwnerOfflineCodeClient({ apiBaseUrl: api.url, ownerOrigin, fetch: input.fetch,
      getAccessToken: async () => (await session())?.access_token ?? null }),
    verifyFreshMfa: (code) => verifyFreshOwnerMfa(auth, code),
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
  if (!(input.approved ?? OWNER_SHEET_FLOW_LAUNCH_APPROVED)) return null;
  const api = getApiEnv(input.env);
  const ownerOrigin = input.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN?.trim();
  const auth = input.auth;
  if (!auth || !api.isConfigured || !ownerOrigin) return null;
  return createOwnerSheetListFlow({
    client: createOwnerOfflineCodeClient({ apiBaseUrl: api.url, ownerOrigin, fetch: input.fetch,
      getAccessToken: async () => (await auth.getSession()).data.session?.access_token ?? null }),
    verifyFreshMfa: (code) => verifyFreshOwnerMfa(auth, code),
    randomUUID,
  });
}

async function verifyFreshOwnerMfa(auth: OwnerSupabaseAuth, code: string): Promise<boolean> {
  const factors = await auth.mfa?.listFactors?.();
  const factor = factors?.data?.totp?.find((entry) => entry.status === "verified");
  if (!factor || !/^\d{6}$/u.test(code)) return false;
  const result = await createTotpVerifyService({ auth: { mfa: auth.mfa } }).verify(factor.id, code);
  if (result.status !== "ok") return false;
  await auth.refreshSession();
  return true;
}

/** The list handle for "My emergency sheets", or null while the feature is not approved. */
export function useOwnerSheetListHandle(): OwnerSheetListFlow | null {
  return useMemo(() => {
    if (!OWNER_SHEET_FLOW_LAUNCH_APPROVED) return null;
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
    if (!OWNER_SHEET_FLOW_LAUNCH_APPROVED) return null;
    return createOwnerSheetFlowHandle({ createSheet,
      auth: (createSupabaseClient()?.auth ?? null) as unknown as OwnerSupabaseAuth | null,
      // Literal reads so Expo inlines the public build-time values.
      env: { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
        EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN: process.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN } });
  }, [createSheet]);
}
