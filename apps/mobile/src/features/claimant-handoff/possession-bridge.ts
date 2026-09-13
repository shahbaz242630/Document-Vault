import type { OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { z } from "zod";

import { createOfflineCodeV2Lifecycle, type OfflineCodeV2LifecycleSource } from "../claimant-offline-code/offline-code-v2-lifecycle";
import type { OfflineCodeV2SyntheticAttempt, OfflineCodeV2VerifiedSource } from "../claimant-offline-code/offline-code-v2-coordinator";
import type { OfflineCodeV2ProofInput } from "../claimant-offline-code/offline-code-v2-proof-core";
import type { OfflineCodeV2Send } from "../claimant-offline-code/offline-code-v2-transport";
import { attemptSchema, HandoffUnavailableError, validateSession, type HandoffCompletion,
  type HandoffSession } from "./contracts";
import { createHandoffLifecycle } from "./lifecycle";
import type { HandoffSend } from "./transport";

export const CLAIMANT_POSSESSION_HANDOFF_BRIDGE_APPROVED = false as const;

const eventSchema = z.strictObject({ sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  state: z.enum(["foreground", "inactive", "background", "locked", "session_ended", "disabled"]) });
type Event = z.infer<typeof eventSchema>;
type Binding = Pick<HandoffSession, "userId" | "sessionId" | "sessionVersion">;
export type PossessionHandoffAttempt = Readonly<{ possession: OfflineCodeV2SyntheticAttempt;
  issueIdempotencyKey: string; completionIdempotencyKey: string }>;
type Input = Readonly<{
  approved?: boolean; syntheticOnly: true; productionRuntime: false;
  apiOrigin: string; claimantOrigin: string;
  possessionSend: OfflineCodeV2Send; handoffSend: HandoffSend;
  producer: Readonly<{ produce(value: OfflineCodeV2ProofInput): Promise<OfflineCodePossessionProofV2> }>;
  signer: Readonly<{ syntheticOnly: true; sign(value: Readonly<{ transcriptBytesBase64url: string;
    challengeId: string; recordBindingDigest: string; signal: AbortSignal }>): Promise<string> }>;
  getSession: () => unknown; lifecycle: OfflineCodeV2LifecycleSource; now?: () => number;
}>;

function disabledBridge() {
  return Object.freeze({
    start: (_value: PossessionHandoffAttempt): Promise<HandoffCompletion> => Promise.reject(new HandoffUnavailableError()),
    retryProof: (): Promise<HandoffCompletion> => Promise.reject(new HandoffUnavailableError()),
    retryCompletion: (): Promise<HandoffCompletion> => Promise.reject(new HandoffUnavailableError()),
    cancel() {}, dispose: () => Promise.resolve(),
    snapshot: () => Object.freeze({ status: "disabled" as const, identity_verified: false as const,
      claim_created: false as const, release_authorized: false as const }),
  });
}

function subscribeLifecycle(host: OfflineCodeV2LifecycleSource, transition: (state: Event["state"]) => void,
  terminal: () => void, isClosed: () => boolean) {
  let lastEvent: Event | null = null;
  let unsubscribe: (() => void) | null = null;
  const listeners = new Set<(event: unknown) => void>();
  const source: OfflineCodeV2LifecycleSource = { subscribe(listener) {
    listeners.add(listener);
    if (lastEvent) listener(lastEvent);
    return () => { listeners.delete(listener); };
  } };
  function detach() {
    const cleanup = unsubscribe; unsubscribe = null;
    try { cleanup?.(); } catch { /* No host detail escapes. */ }
    listeners.clear();
  }
  function onEvent(value: unknown) {
    if (isClosed()) return;
    try {
      const event = eventSchema.parse(value);
      if (lastEvent && event.sequence <= lastEvent.sequence) {
        if (event.sequence === lastEvent.sequence && event.state === lastEvent.state) return;
        terminal(); return;
      }
      lastEvent = Object.freeze(event);
      for (const listener of listeners) listener(event);
      if (["locked", "session_ended", "disabled"].includes(event.state)) terminal();
      else transition(event.state);
    } catch { terminal(); }
  }
  try {
    const cleanup = host.subscribe(onEvent);
    if (typeof cleanup !== "function") throw new Error();
    unsubscribe = cleanup;
    if (!lastEvent || isClosed()) terminal();
  } catch { terminal(); }
  if (isClosed()) detach();
  return { source, detach, hasInitial: !!lastEvent };
}

function sameSession(binding: Binding, sessionReader: () => unknown, clock: () => number): void {
  const session = validateSession(sessionReader(), clock());
  if (session.userId !== binding.userId || session.sessionId !== binding.sessionId
    || session.sessionVersion !== binding.sessionVersion) throw new Error();
}

function verifiedAttempt(source: OfflineCodeV2VerifiedSource,
  keys: Pick<PossessionHandoffAttempt, "issueIdempotencyKey" | "completionIdempotencyKey">) {
  if (source.result.route_possession_asserted !== true) throw new Error();
  return attemptSchema.parse({ syntheticOnly: true, challengeId: source.challengeId,
    recordBindingDigest: source.recordBindingDigest, ...keys });
}

// The only bridge input is pre-provisioned synthetic possession material and fresh idempotency keys.
// The source challenge and digest come solely from the server-verified proof request.
export function createPossessionHandoffBridge(input: Input) {
  const approved = input.approved ?? CLAIMANT_POSSESSION_HANDOFF_BRIDGE_APPROVED;
  if (!approved) return disabledBridge();
  let status: "ready" | "working" | "unavailable" | "completed" | "suspended" | "closed" = "suspended";
  let closed = false; let foreground = false; let generation = 0;
  let active = false; let activeCompletion: Promise<void> | null = null;
  let phase: "proof" | "handoff" | null = null;
  let keys: Pick<PossessionHandoffAttempt, "issueIdempotencyKey" | "completionIdempotencyKey"> | null = null;
  let binding: Binding | null = null;
  const clock = input.now ?? Date.now;
  const sessionReader = input.getSession;
  let hub!: ReturnType<typeof subscribeLifecycle>;
  let possession!: ReturnType<typeof createOfflineCodeV2Lifecycle>;
  let handoff!: ReturnType<typeof createHandoffLifecycle>;

  function clear() { phase = null; keys = null; binding = null; generation += 1;
    possession?.cancel(); handoff?.cancel(); }
  function close() {
    if (closed) return;
    closed = true; foreground = false; status = "closed"; clear();
    hub?.detach(); void possession?.dispose(); void handoff?.dispose();
  }
  try {
    if (input.syntheticOnly !== true || input.productionRuntime !== false
      || typeof sessionReader !== "function" || typeof input.lifecycle.subscribe !== "function") throw new Error();
    hub = subscribeLifecycle(input.lifecycle, (state) => {
      if (state !== "foreground") { foreground = false; status = "suspended"; clear(); }
      else if (!foreground) { foreground = true; status = active ? "working" : "ready"; }
    }, close, () => closed);
  } catch { close(); }
  const source = hub?.source ?? { subscribe: () => () => undefined };
  possession = createOfflineCodeV2Lifecycle({ approved: approved && !closed,
    syntheticOnly: input.syntheticOnly, productionRuntime: input.productionRuntime,
    apiOrigin: input.apiOrigin, claimantOrigin: input.claimantOrigin, send: input.possessionSend,
    producer: input.producer, lifecycle: source, now: () => new Date(clock()) });
  handoff = createHandoffLifecycle({ approved: approved && !closed,
    syntheticOnly: input.syntheticOnly, productionRuntime: input.productionRuntime,
    apiOrigin: input.apiOrigin, claimantOrigin: input.claimantOrigin, send: input.handoffSend,
    signer: input.signer, getSession: sessionReader, lifecycle: source, now: clock });
  if (approved && (!hub?.hasInitial || closed || possession.snapshot().status === "closed"
    || handoff.snapshot().status === "closed")) close();
  function assertBinding(): void {
    if (!binding) throw new Error();
    try { sameSession(binding, sessionReader, clock); }
    catch { close(); throw new HandoffUnavailableError(); }
  }
  async function run(operation: () => Promise<HandoffCompletion>): Promise<HandoffCompletion> {
    if (closed || !foreground || active || possession.snapshot().status === "closed"
      || handoff.snapshot().status === "closed") throw new HandoffUnavailableError();
    const currentGeneration = generation;
    active = true; status = "working";
    let finish!: () => void;
    activeCompletion = new Promise<void>((resolve) => { finish = resolve; });
    try {
      const result = await operation();
      if (closed || !foreground || generation !== currentGeneration) throw new Error();
      assertBinding(); status = "completed"; keys = null; binding = null; phase = null;
      return result;
    } catch {
      if (!closed && foreground && generation === currentGeneration) status = "unavailable";
      throw new HandoffUnavailableError();
    } finally {
      active = false; activeCompletion = null; finish();
      if (!closed && foreground && generation !== currentGeneration) status = "ready";
    }
  }
  async function continueWith(sourceReceipt: OfflineCodeV2VerifiedSource): Promise<HandoffCompletion> {
    assertBinding();
    if (!keys) throw new Error();
    const attempt = verifiedAttempt(sourceReceipt, keys);
    phase = "handoff"; keys = null;
    return handoff.start(attempt);
  }
  return Object.freeze({
    start(value: PossessionHandoffAttempt): Promise<HandoffCompletion> {
      if (phase) return Promise.reject(new HandoffUnavailableError());
      return run(async () => {
        const session = validateSession(sessionReader(), clock());
        binding = Object.freeze({ userId: session.userId, sessionId: session.sessionId,
          sessionVersion: session.sessionVersion });
        keys = Object.freeze({ issueIdempotencyKey: value.issueIdempotencyKey,
          completionIdempotencyKey: value.completionIdempotencyKey });
        phase = "proof";
        return continueWith(await possession.startVerified(value.possession));
      });
    },
    retryProof(): Promise<HandoffCompletion> {
      if (phase !== "proof") return Promise.reject(new HandoffUnavailableError());
      return run(async () => { assertBinding(); return continueWith(await possession.retryProofVerified()); });
    },
    retryCompletion(): Promise<HandoffCompletion> {
      if (phase !== "handoff") return Promise.reject(new HandoffUnavailableError());
      return run(async () => { assertBinding(); return handoff.retryCompletion(); });
    },
    cancel() { if (closed) return; clear(); status = foreground ? (active ? "working" : "ready") : "suspended"; },
    async dispose(): Promise<void> { close(); await activeCompletion; },
    snapshot() { return Object.freeze({ status, identity_verified: false as const,
      claim_created: false as const, release_authorized: false as const }); },
  });
}
