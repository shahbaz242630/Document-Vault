import { useMemo } from "react";
import { randomUUID } from "expo-crypto";

import { createTotpVerifyService } from "@/features/auth/totp-verify-service";
import { useVaultSession } from "@/features/vault";
import { createSupabaseClient } from "@/shared/api/supabase-client";
import { getApiEnv } from "@/shared/config/api-env";
import { withClaimantPreviewBypass } from "@/shared/config/claimant-preview-fetch";

import { createOwnerOfflineCodeClient } from "./owner-offline-code-client";
import {
  createOwnerSheetCopyStore,
  deviceOwnerSheetCopyFiles,
  type OwnerSheetCopySealer,
  type OwnerSheetCopyStore,
} from "./owner-sheet-copy-store";
import { createOwnerSheetDetailFlow, type OwnerSheetDetailFlow } from "./owner-sheet-detail-flow";
import { createOwnerSheetExporter, deviceOwnerSheetExportDeps, type OwnerSheetExporter } from "./owner-sheet-export";
import { createOwnerSheetFlow, type OwnerSheetFlow, type OwnerSheetFlowDeps } from "./owner-sheet-flow";
import { createOwnerSheetListFlow, type OwnerSheetListFlow } from "./owner-sheet-list-flow";
import { renderOwnerSheetHtml } from "./owner-sheet-html";
import { ownerSheetsOpen } from "./owner-sheet-launch";

/*
 * Slice 6H composition, PDF-first since 2026-10-01: the only place the owner sheet flows meet the vault session,
 * Supabase, the API, the device copy store and the PDF exporter. While the owner sheets are closed (owner-sheet-launch.ts) the handle is null before anything is
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

type DeviceParts = Readonly<{ copies?: OwnerSheetCopyStore; exporter?: OwnerSheetExporter }>;

export function createOwnerSheetFlowHandle(input: Readonly<{
  approved?: boolean;
  createSheet: OwnerSheetFlowDeps["createSheet"];
  sealer: OwnerSheetCopySealer;
  auth: OwnerSupabaseAuth | null;
  env: Env;
  fetch?: typeof fetch;
}> & DeviceParts): OwnerSheetFlow | null {
  if (!(input.approved ?? ownerSheetsOpen())) return null;
  const api = getApiEnv(input.env);
  const ownerOrigin = input.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN?.trim();
  const auth = input.auth;
  if (!auth || !api.isConfigured || !ownerOrigin) return null;
  const session = async () => (await auth.getSession()).data.session;
  const client = createOwnerOfflineCodeClient({ apiBaseUrl: api.url, ownerOrigin,
    fetch: input.fetch ?? withClaimantPreviewBypass(fetch),
    getAccessToken: async () => (await session())?.access_token ?? null });
  return createOwnerSheetFlow({
    createSheet: input.createSheet,
    getOwnerId: async () => (await session())?.user.id ?? null,
    client,
    verifyFreshMfa: (code) => verifyFreshOwnerMfa(auth, client, code),
    copies: input.copies ?? deviceCopies(input.sealer),
    exporter: input.exporter ?? createOwnerSheetExporter(deviceOwnerSheetExportDeps()),
    renderSheetHtml: renderOwnerSheetHtml,
    randomUUID,
  });
}

/** PDF-first: one sheet's screen, behind the same launch approval; it opens copies only through the vault session. */
export function createOwnerSheetDetailHandle(input: Readonly<{
  approved?: boolean;
  locatorRecordId: string;
  sealer: OwnerSheetCopySealer;
  isLocked: () => boolean;
  auth: OwnerSupabaseAuth | null;
  env: Env;
  fetch?: typeof fetch;
}> & DeviceParts): OwnerSheetDetailFlow | null {
  if (!(input.approved ?? ownerSheetsOpen())) return null;
  const api = getApiEnv(input.env);
  const ownerOrigin = input.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN?.trim();
  const auth = input.auth;
  if (!auth || !api.isConfigured || !ownerOrigin) return null;
  const session = async () => (await auth.getSession()).data.session;
  const client = createOwnerOfflineCodeClient({ apiBaseUrl: api.url, ownerOrigin,
    fetch: input.fetch ?? withClaimantPreviewBypass(fetch),
    getAccessToken: async () => (await session())?.access_token ?? null });
  return createOwnerSheetDetailFlow({ locatorRecordId: input.locatorRecordId, client,
    copies: input.copies ?? deviceCopies(input.sealer),
    exporter: input.exporter ?? createOwnerSheetExporter(deviceOwnerSheetExportDeps()),
    renderSheetHtml: renderOwnerSheetHtml, getOwnerId: async () => (await session())?.user.id ?? null,
    isLocked: input.isLocked, verifyFreshMfa: (code) => verifyFreshOwnerMfa(auth, client, code), randomUUID });
}

function deviceCopies(sealer: OwnerSheetCopySealer): OwnerSheetCopyStore {
  return createOwnerSheetCopyStore({ files: deviceOwnerSheetCopyFiles(), sealer });
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
  const client = createOwnerOfflineCodeClient({ apiBaseUrl: api.url, ownerOrigin,
    fetch: input.fetch ?? withClaimantPreviewBypass(fetch),
    getAccessToken: async () => (await auth.getSession()).data.session?.access_token ?? null });
  return createOwnerSheetListFlow({
    client,
    verifyFreshMfa: (code) => verifyFreshOwnerMfa(auth, client, code),
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
  const sealer = useVaultSheetSealer();
  return useMemo(() => {
    if (!ownerSheetsOpen()) return null;
    return createOwnerSheetFlowHandle({ createSheet, sealer,
      auth: (createSupabaseClient()?.auth ?? null) as unknown as OwnerSupabaseAuth | null,
      // Literal reads so Expo inlines the public build-time values.
      env: { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
        EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN: process.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN } });
  }, [createSheet, sealer]);
}

/** The detail handle for one sheet, or null while the feature is not approved. Locking the vault replaces it. */
export function useOwnerSheetDetailHandle(locatorRecordId: string): OwnerSheetDetailFlow | null {
  const { isLocked } = useVaultSession();
  const sealer = useVaultSheetSealer();
  return useMemo(() => {
    if (!ownerSheetsOpen()) return null;
    return createOwnerSheetDetailHandle({ locatorRecordId, sealer, isLocked: () => isLocked,
      auth: (createSupabaseClient()?.auth ?? null) as unknown as OwnerSupabaseAuth | null,
      env: { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
        EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN: process.env.EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN } });
  }, [locatorRecordId, sealer, isLocked]);
}

function useVaultSheetSealer(): OwnerSheetCopySealer {
  const vault = useVaultSession();
  const seal = vault.sealOwnerSheetCopy;
  const open = vault.openOwnerSheetCopy;
  return useMemo(() => ({ seal, open }), [seal, open]);
}
