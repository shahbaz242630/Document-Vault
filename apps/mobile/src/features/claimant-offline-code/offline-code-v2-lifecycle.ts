import type { OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { z } from "zod";

import { createOfflineCodeV2Coordinator, type OfflineCodeV2SyntheticAttempt } from "./offline-code-v2-coordinator";
import type { OfflineCodeV2ProofInput } from "./offline-code-v2-proof-core";
import { assertOfflineCodeV2Origin, createOfflineCodeV2Transport, OfflineCodeV2UnavailableError,
  type OfflineCodeV2PossessionResult } from "./offline-code-v2-transport";

export const CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED = false as const;

const lifecycleEvent = z.strictObject({
  sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  state: z.enum(["foreground", "inactive", "background", "locked", "session_ended", "disabled"]),
});
type LifecycleEvent = Readonly<z.infer<typeof lifecycleEvent>>;
export type OfflineCodeV2LifecycleSource = Readonly<{
  // Subscribe must synchronously emit current state and return a cleanup function.
  // This belongs to the dedicated synthetic claimant scope, not an owner session.
  subscribe(listener: (event: unknown) => void): () => void;
}>;
type Status = "disabled" | "ready" | "working" | "unavailable" | "completed" | "suspended" | "closed";
export type OfflineCodeV2LifecycleSnapshot = Readonly<{
  status: Status;
  identity_verified: false;
  claim_created: false;
  release_authorized: false;
}>;

type LifecycleInput = Readonly<{
  approved?: boolean;
  syntheticOnly: true;
  productionRuntime: false;
  apiOrigin: string;
  claimantOrigin: string;
  send: typeof fetch;
  producer: Readonly<{ produce(value: OfflineCodeV2ProofInput): Promise<OfflineCodePossessionProofV2> }>;
  lifecycle: OfflineCodeV2LifecycleSource;
  now?: () => Date;
}>;
type LifecycleState = {
  status: Status;
  closed: boolean;
  initialized: boolean;
  foreground: boolean;
  generation: number;
  lastEvent: LifecycleEvent | null;
  active: boolean;
  activeCompletion: Promise<void> | null;
  unsubscribe: (() => void) | null;
  coordinator: ReturnType<typeof createOfflineCodeV2Coordinator> | null;
};

// This is an isolated composition root, not an app entry point or a native adapter.
export function createOfflineCodeV2Lifecycle(input: LifecycleInput) {
  const approved = input.approved ?? CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED;
  const state: LifecycleState = {
    status: approved ? "suspended" : "disabled",
    closed: !approved,
    initialized: false,
    foreground: false,
    generation: 0,
    lastEvent: null,
    active: false,
    activeCompletion: null,
    unsubscribe: null,
    coordinator: null,
  };
  if (approved) initialize(state, input);
  return createLifecycleApi(state);
}

function detach(state: LifecycleState): void {
  const cleanup = state.unsubscribe;
  state.unsubscribe = null;
  try { cleanup?.(); } catch { /* No adapter detail escapes cleanup. */ }
}

function invalidate(state: LifecycleState): void {
  state.generation += 1;
  state.coordinator?.cancel();
}

function close(state: LifecycleState): void {
  if (state.closed) return;
  state.closed = true;
  state.foreground = false;
  state.status = "closed";
  invalidate(state);
  detach(state);
}

function onEvent(state: LifecycleState, value: unknown): void {
  if (state.closed) return;
  try {
    const event = lifecycleEvent.parse(value);
    const lastEvent = state.lastEvent;
    if (lastEvent && event.sequence <= lastEvent.sequence) {
      if (event.sequence === lastEvent.sequence && event.state === lastEvent.state) return;
      close(state); return;
    }
    state.lastEvent = Object.freeze(event);
    if (event.state === "locked" || event.state === "session_ended" || event.state === "disabled") {
      close(state); return;
    }
    if (event.state !== "foreground") {
      state.foreground = false;
      state.status = "suspended";
      invalidate(state);
    } else if (!state.foreground) {
      state.foreground = true;
      // A cancelled KDF may still be settling; do not expose readiness for another attempt yet.
      state.status = state.active ? "working" : "ready";
    }
  } catch { close(state); }
}

function initialize(state: LifecycleState, input: LifecycleInput): void {
  try {
    if (input.syntheticOnly !== true || input.productionRuntime !== false) throw new Error();
    const apiOrigin = input.apiOrigin;
    const claimantOrigin = input.claimantOrigin;
    assertOfflineCodeV2Origin(apiOrigin);
    assertOfflineCodeV2Origin(claimantOrigin);
    if (apiOrigin === claimantOrigin || typeof input.send !== "function"
      || typeof input.producer.produce !== "function") throw new Error();
    // Snapshot adapter methods so replacing the caller's dependency object cannot rebind this scope.
    const send = input.send;
    const producer = { produce: input.producer.produce.bind(input.producer) };
    state.coordinator = createOfflineCodeV2Coordinator({ approved: true, claimantOrigin, producer, now: input.now,
      transport: createOfflineCodeV2Transport({ approved: true, apiOrigin, claimantOrigin, send }) });
    const cleanup = input.lifecycle.subscribe((value) => onEvent(state, value));
    if (typeof cleanup !== "function") throw new Error();
    state.unsubscribe = cleanup;
    const { lastEvent, closed } = state;
    if (!lastEvent || closed) { close(state); detach(state); }
    else state.initialized = true;
  } catch { close(state); detach(state); }
}

async function run(state: LifecycleState,
  operation: () => Promise<OfflineCodeV2PossessionResult>): Promise<OfflineCodeV2PossessionResult> {
  const { closed, initialized, foreground, active, coordinator } = state;
  if (closed || !initialized || !foreground || active || !coordinator) throw new OfflineCodeV2UnavailableError();
  const startedGeneration = state.generation;
  state.active = true;
  let finish!: () => void;
  state.activeCompletion = new Promise<void>((resolve) => { finish = resolve; });
  state.status = "working";
  try {
    const result = await operation();
    if (state.closed || !state.foreground || state.generation !== startedGeneration) throw new Error();
    state.status = "completed";
    return result;
  } catch {
    if (!state.closed && state.foreground && state.generation === startedGeneration) state.status = "unavailable";
    throw new OfflineCodeV2UnavailableError();
  } finally {
    state.active = false;
    // Resuming the host never resumes or replays an old attempt automatically.
    if (!state.closed && state.foreground && state.generation !== startedGeneration) state.status = "ready";
    state.activeCompletion = null;
    finish();
  }
}

function createLifecycleApi(state: LifecycleState) {
  return Object.freeze({
    start: (value: OfflineCodeV2SyntheticAttempt) => run(state, () => state.coordinator!.start(value)),
    retryProof: () => run(state, () => state.coordinator!.retryProof()),
    cancel(): void {
      if (state.closed) return;
      invalidate(state);
      state.status = state.foreground ? (state.active ? "working" : "ready") : "suspended";
    },
    dispose(): Promise<void> {
      close(state);
      // Hosts can wait for non-interruptible producer cleanup without receiving its result/error.
      const activeCompletion = state.activeCompletion;
      return activeCompletion ?? Promise.resolve();
    },
    snapshot(): OfflineCodeV2LifecycleSnapshot {
      // No response, material, identifiers, error detail, or reusable authority is retained here.
      return Object.freeze({ status: state.status, identity_verified: false,
        claim_created: false, release_authorized: false });
    },
  });
}
