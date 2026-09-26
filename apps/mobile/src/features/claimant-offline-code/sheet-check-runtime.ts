import { useMemo } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { randomUUID } from "expo-crypto";
import { fetch as expoFetch } from "expo/fetch";

import { createSheetCheckFlow, type SheetCheckFlow, type SheetCheckPort,
  type SheetCheckSeen } from "@/features/claimant-journey/sheet-check-flow";
import { getApiEnv } from "@/shared/config/api-env";
import { isClaimantPreviewBuild } from "@/shared/config/claimant-preview-build";

import { CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED, createOfflineCodeV2Lifecycle,
  type OfflineCodeV2LifecycleSource } from "./offline-code-v2-lifecycle";
import { createOfflineCodeV2PlatformProofProducer } from "./offline-code-v2-proof-producer";

/*
 * Staging wiring W2a: the only composition of the claimant "check a sheet" screen, and only in the Preview build.
 * Outside it the handle is null before anything is created, so the entry is hidden and the screen shows
 * "unavailable". The offline-code V2 chain keeps its own literal-false approvals; this root opens it for the
 * Preview build only, for one possession check at a time, and never reaches the handoff, the claimant session
 * or a claim.
 */
type Env = Partial<Record<string, string>>;
type LifecycleInput = Parameters<typeof createOfflineCodeV2Lifecycle>[0];
type Send = LifecycleInput["send"];
type Producer = LifecycleInput["producer"];

export type SheetCheckHandle = Readonly<{ open(): SheetCheckFlow }>;

export function createSheetCheckHandle(input: Readonly<{
  approved?: boolean;
  env: Env;
  send?: Send;
  producer?: Producer;
  lifecycle?: OfflineCodeV2LifecycleSource;
  newKey?: () => string;
  now?: () => Date;
}>): SheetCheckHandle | null {
  const approved = input.approved ?? (CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED || isClaimantPreviewBuild());
  if (!approved) return null;
  const api = getApiEnv(input.env);
  const apiOrigin = api.isConfigured ? originOf(api.url) : null;
  const claimantOrigin = originOf(input.env.EXPO_PUBLIC_OFFLINE_CODE_V2_CLAIMANT_ORIGIN);
  if (!apiOrigin || !claimantOrigin || apiOrigin === claimantOrigin) return null;
  return Object.freeze({
    open: () => createSheetCheckFlow({ newKey: input.newKey ?? randomUUID, port: createSheetCheckPort({
      approved, apiOrigin, claimantOrigin, send: input.send ?? (expoFetch as unknown as Send),
      producer: input.producer ?? createOfflineCodeV2PlatformProofProducer(approved),
      lifecycle: input.lifecycle ?? appLifecycle(), now: input.now }) }),
  });
}

function createSheetCheckPort(input: Readonly<{ approved: boolean; apiOrigin: string; claimantOrigin: string;
  send: Send; producer: Producer; lifecycle: OfflineCodeV2LifecycleSource; now?: () => Date }>): SheetCheckPort {
  let current: SheetCheckSeen | null = null;
  const base = input.producer;
  const lifecycle = createOfflineCodeV2Lifecycle({ approved: input.approved, syntheticOnly: true,
    productionRuntime: false, apiOrigin: input.apiOrigin, claimantOrigin: input.claimantOrigin,
    send: observedSend(input.send, () => current), lifecycle: input.lifecycle, now: input.now,
    producer: { async produce(value) {
      const seen = current;
      if (seen) seen.proving = true;
      try { return await base.produce(value); } catch (error) { if (seen) seen.proofFailed = true; throw error; }
    } } });
  return Object.freeze({
    async start(attempt, seen) {
      current = seen;
      try { return await lifecycle.start(attempt); } finally { if (current === seen) current = null; }
    },
    cancel: () => lifecycle.cancel(),
    dispose: () => lifecycle.dispose(),
  });
}

/** Records only which step answered and how; the response itself goes to the transport untouched. */
function observedSend(send: Send, current: () => SheetCheckSeen | null): Send {
  return async (url, init) => {
    const seen = current();
    const proof = url.endsWith("/proofs");
    let response: Response;
    try { response = await send(url, init); } catch (error) { if (seen) seen.faulted = true; throw error; }
    if (seen) {
      if (response.status === 200) { if (!proof) seen.issued = true; }
      else if (proof && response.status === 401) seen.rejected = true;
      else seen.faulted = true;
    }
    return response;
  };
}

function appLifecycle(): OfflineCodeV2LifecycleSource {
  return {
    subscribe(listener) {
      let sequence = 0;
      const emit = (state: AppStateStatus) => listener({ sequence: sequence++,
        state: state === "active" ? "foreground" : state === "inactive" ? "inactive" : "background" });
      emit(AppState.currentState);
      const subscription = AppState.addEventListener("change", emit);
      return () => subscription.remove();
    },
  };
}

function originOf(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/u, "");
  if (!trimmed) return null;
  try { return new URL(trimmed).origin === trimmed && trimmed.startsWith("https://") ? trimmed : null; }
  catch { return null; }
}

/** The handle for "Check an emergency sheet", or null outside the Preview build or without its configuration. */
export function useSheetCheckHandle(): SheetCheckHandle | null {
  return useMemo(() => {
    if (!isClaimantPreviewBuild()) return null;
    return createSheetCheckHandle({
      // Literal reads so Expo inlines the public build-time values.
      env: { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
        EXPO_PUBLIC_OFFLINE_CODE_V2_CLAIMANT_ORIGIN: process.env.EXPO_PUBLIC_OFFLINE_CODE_V2_CLAIMANT_ORIGIN } });
  }, []);
}
