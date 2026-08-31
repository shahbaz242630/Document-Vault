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

// This is an isolated composition root, not an app entry point or a native adapter.
export function createOfflineCodeV2Lifecycle(input: Readonly<{
  approved?: boolean;
  syntheticOnly: true;
  productionRuntime: false;
  apiOrigin: string;
  claimantOrigin: string;
  send: typeof fetch;
  producer: Readonly<{ produce(value: OfflineCodeV2ProofInput): Promise<OfflineCodePossessionProofV2> }>;
  lifecycle: OfflineCodeV2LifecycleSource;
  now?: () => Date;
}>) {
  const approved = input.approved ?? CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED;
  let status: Status = approved ? "suspended" : "disabled";
  let closed = !approved;
  let initialized = false;
  let foreground = false;
  let generation = 0;
  let lastEvent: LifecycleEvent | null = null;
  let active = false;
  let activeCompletion: Promise<void> | null = null;
  let unsubscribe: (() => void) | null = null;
  let coordinator: ReturnType<typeof createOfflineCodeV2Coordinator> | null = null;

  function detach(): void {
    const cleanup = unsubscribe;
    unsubscribe = null;
    try { cleanup?.(); } catch { /* No adapter detail escapes cleanup. */ }
  }
  function invalidate(): void {
    generation += 1;
    coordinator?.cancel();
  }
  function close(): void {
    if (closed) return;
    closed = true;
    foreground = false;
    status = "closed";
    invalidate();
    detach();
  }
  function onEvent(value: unknown): void {
    if (closed) return;
    try {
      const event = lifecycleEvent.parse(value);
      if (lastEvent && event.sequence <= lastEvent.sequence) {
        if (event.sequence === lastEvent.sequence && event.state === lastEvent.state) return;
        close(); return;
      }
      lastEvent = Object.freeze(event);
      if (event.state === "locked" || event.state === "session_ended" || event.state === "disabled") {
        close(); return;
      }
      if (event.state !== "foreground") {
        foreground = false;
        status = "suspended";
        invalidate();
      } else if (!foreground) {
        foreground = true;
        // A cancelled KDF may still be settling; do not expose readiness for another attempt yet.
        status = active ? "working" : "ready";
      }
    } catch { close(); }
  }

  if (approved) {
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
      coordinator = createOfflineCodeV2Coordinator({ approved: true, claimantOrigin, producer, now: input.now,
        transport: createOfflineCodeV2Transport({ approved: true, apiOrigin, claimantOrigin, send }) });
      const cleanup = input.lifecycle.subscribe(onEvent);
      if (typeof cleanup !== "function") throw new Error();
      unsubscribe = cleanup;
      if (!lastEvent || closed) { close(); detach(); }
      else initialized = true;
    } catch { close(); detach(); }
  }

  async function run(operation: () => Promise<OfflineCodeV2PossessionResult>): Promise<OfflineCodeV2PossessionResult> {
    if (closed || !initialized || !foreground || active || !coordinator) throw new OfflineCodeV2UnavailableError();
    const startedGeneration = generation;
    active = true;
    let finish!: () => void;
    activeCompletion = new Promise<void>((resolve) => { finish = resolve; });
    status = "working";
    try {
      const result = await operation();
      if (closed || !foreground || generation !== startedGeneration) throw new Error();
      status = "completed";
      return result;
    } catch {
      if (!closed && foreground && generation === startedGeneration) status = "unavailable";
      throw new OfflineCodeV2UnavailableError();
    } finally {
      active = false;
      // Resuming the host never resumes or replays an old attempt automatically.
      if (!closed && foreground && generation !== startedGeneration) status = "ready";
      activeCompletion = null;
      finish();
    }
  }

  return Object.freeze({
    start: (value: OfflineCodeV2SyntheticAttempt) => run(() => coordinator!.start(value)),
    retryProof: () => run(() => coordinator!.retryProof()),
    cancel(): void {
      if (closed) return;
      invalidate();
      status = foreground ? (active ? "working" : "ready") : "suspended";
    },
    dispose(): Promise<void> {
      close();
      // Hosts can wait for non-interruptible producer cleanup without receiving its result/error.
      return activeCompletion ?? Promise.resolve();
    },
    snapshot(): OfflineCodeV2LifecycleSnapshot {
      // No response, material, identifiers, error detail, or reusable authority is retained here.
      return Object.freeze({ status, identity_verified: false, claim_created: false, release_authorized: false });
    },
  });
}
