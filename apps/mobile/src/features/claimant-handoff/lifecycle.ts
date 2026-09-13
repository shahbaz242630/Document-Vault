import { z } from "zod";

import { assertOrigin, HandoffUnavailableError, type HandoffAttempt, type HandoffCompletion } from "./contracts";
import { createHandoffCoordinator } from "./coordinator";
import { createHandoffTransport, type HandoffSend } from "./transport";

export const CLAIMANT_HANDOFF_LIFECYCLE_APPROVED = false as const;

const eventSchema = z.strictObject({
  sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  state: z.enum(["foreground", "inactive", "background", "locked", "session_ended", "disabled"]),
});
type Event = Readonly<z.infer<typeof eventSchema>>;
export type HandoffLifecycleSource = Readonly<{
  // The current state must be emitted synchronously before subscribe returns.
  subscribe(listener: (event: unknown) => void): () => void;
}>;
type Status = "disabled" | "ready" | "working" | "unavailable" | "completed" | "suspended" | "closed";
export type HandoffLifecycleSnapshot = Readonly<{
  status: Status; identity_verified: false; claim_created: false; release_authorized: false;
}>;
type Input = Readonly<{
  approved?: boolean; syntheticOnly: true; productionRuntime: false;
  apiOrigin: string; claimantOrigin: string; send: HandoffSend;
  getSession: () => unknown;
  signer: Readonly<{ syntheticOnly: true; sign: (value: Readonly<{
    transcriptBytesBase64url: string; challengeId: string; recordBindingDigest: string;
    signal: AbortSignal;
  }>) => Promise<string> }>;
  lifecycle: HandoffLifecycleSource; now?: () => number;
}>;

// An isolated synthetic composition root. No normal app entry point imports this module.
export function createHandoffLifecycle(input: Input) {
  const approved = input.approved ?? CLAIMANT_HANDOFF_LIFECYCLE_APPROVED;
  let status: Status = approved ? "suspended" : "disabled";
  let closed = !approved; let initialized = false; let foreground = false;
  let generation = 0; let lastEvent: Event | null = null; let active = false;
  let activeCompletion: Promise<void> | null = null;
  let unsubscribe: (() => void) | null = null;
  let coordinator: ReturnType<typeof createHandoffCoordinator> | null = null;

  function detach() {
    const cleanup = unsubscribe; unsubscribe = null;
    try { cleanup?.(); } catch { /* Adapter details never leave the lifecycle. */ }
  }
  function invalidate() { generation += 1; coordinator?.cancel(); }
  function close() {
    if (closed) return;
    closed = true; foreground = false; status = "closed";
    invalidate(); detach();
  }
  function onEvent(value: unknown) {
    if (closed) return;
    try {
      const event = eventSchema.parse(value);
      if (lastEvent && event.sequence <= lastEvent.sequence) {
        if (event.sequence === lastEvent.sequence && event.state === lastEvent.state) return;
        close(); return;
      }
      lastEvent = Object.freeze(event);
      if (event.state === "locked" || event.state === "session_ended" || event.state === "disabled") {
        close(); return;
      }
      if (event.state !== "foreground") {
        foreground = false; status = "suspended"; invalidate();
      } else if (!foreground) {
        foreground = true; status = active ? "working" : "ready";
      }
    } catch { close(); }
  }
  if (approved) {
    try {
      if (input.syntheticOnly !== true || input.productionRuntime !== false) throw new Error();
      assertOrigin(input.apiOrigin); assertOrigin(input.claimantOrigin);
      if (input.apiOrigin === input.claimantOrigin || typeof input.send !== "function"
        || typeof input.getSession !== "function" || input.signer?.syntheticOnly !== true
        || typeof input.signer.sign !== "function") throw new Error();
      const send = input.send; const getSession = input.getSession;
      const signer = { syntheticOnly: true as const, sign: input.signer.sign.bind(input.signer) };
      coordinator = createHandoffCoordinator({ approved: true, now: input.now, signer, getSession,
        transport: createHandoffTransport({ approved: true, apiOrigin: input.apiOrigin,
          claimantOrigin: input.claimantOrigin, send }) });
      const cleanup = input.lifecycle.subscribe(onEvent);
      if (typeof cleanup !== "function") throw new Error();
      unsubscribe = cleanup;
      if (!lastEvent || closed) { close(); detach(); }
      else initialized = true;
    } catch { close(); detach(); }
  }
  async function run(operation: (client: NonNullable<typeof coordinator>) => Promise<HandoffCompletion>) {
    if (closed || !initialized || !foreground || active || !coordinator) throw new HandoffUnavailableError();
    const startedGeneration = generation;
    const client = coordinator;
    active = true;
    let finish!: () => void;
    activeCompletion = new Promise<void>((resolve) => { finish = resolve; });
    status = "working";
    try {
      const result = await operation(client);
      if (closed || !foreground || generation !== startedGeneration) throw new Error();
      status = "completed";
      return result;
    } catch {
      if (!closed && foreground && generation === startedGeneration) status = "unavailable";
      throw new HandoffUnavailableError();
    } finally {
      active = false;
      if (!closed && foreground && generation !== startedGeneration) status = "ready";
      activeCompletion = null; finish();
    }
  }
  return Object.freeze({
    start: (attempt: HandoffAttempt) => run((client) => client.start(attempt)),
    retryCompletion: () => run((client) => client.retryCompletion()),
    cancel() {
      if (closed) return;
      invalidate(); status = foreground ? (active ? "working" : "ready") : "suspended";
    },
    dispose(): Promise<void> { close(); return activeCompletion ?? Promise.resolve(); },
    snapshot(): HandoffLifecycleSnapshot {
      return Object.freeze({ status, identity_verified: false, claim_created: false,
        release_authorized: false });
    },
  });
}
