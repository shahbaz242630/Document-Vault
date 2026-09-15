import { z } from "zod";

import { HandoffUnavailableError, validateSession, type HandoffCompletion, type HandoffSession } from "./contracts";
import { createPossessionHandoffBridge, type PossessionHandoffAttempt } from "./possession-bridge";

export const CLAIMANT_SESSION_BRIDGE_COMPOSITION_APPROVED = false as const;

const eventSchema = z.strictObject({
  sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  state: z.enum(["foreground", "inactive", "background", "locked", "session_ended", "disabled"]),
});
type Event = z.infer<typeof eventSchema>;
type BridgeInput = Parameters<typeof createPossessionHandoffBridge>[0];
type SessionBinding = Pick<HandoffSession, "userId" | "sessionId" | "sessionVersion">;
type Source = Readonly<{ subscribe(listener: (value: unknown) => void): () => void }>;

type Input = Readonly<{
  approved?: boolean;
  syntheticOnly: true;
  productionRuntime: false;
  session: Source & Readonly<{ syntheticOnly: true }>;
  lifecycle: BridgeInput["lifecycle"];
  bridge: Omit<BridgeInput, "approved" | "syntheticOnly" | "productionRuntime" | "getSession" | "lifecycle">;
  now?: () => number;
}>;

export type SessionBoundDraft = Readonly<{
  state: "draft";
  route_profile: "offline_code_v2";
  case_version: 1;
  claimant_session_bound: true;
  case_created: true;
  identity_verified: false;
  relationship_verified: false;
  intake_started: false;
  review_started: false;
  release_authorized: false;
}>;

function unavailable(): Promise<SessionBoundDraft> {
  return Promise.reject(new HandoffUnavailableError());
}

function inert(status: "disabled" | "closed") {
  return Object.freeze({
    start: (_value: PossessionHandoffAttempt) => unavailable(),
    retryProof: () => unavailable(),
    retryCompletion: () => unavailable(),
    cancel() {},
    dispose: () => Promise.resolve(),
    snapshot: () => Object.freeze({ status, draft_available: false as const,
      identity_verified: false as const, release_authorized: false as const }),
  });
}

function sameBinding(left: SessionBinding, right: HandoffSession): boolean {
  return left.userId === right.userId && left.sessionId === right.sessionId
    && left.sessionVersion === right.sessionVersion;
}

function safeDraft(result: HandoffCompletion): SessionBoundDraft {
  if (result.state !== "draft" || result.route_profile !== "offline_code_v2"
    || result.case_version !== 1 || result.claimant_session_bound !== true || result.case_created !== true
    || result.identity_verified !== false || result.relationship_verified !== false
    || result.intake_started !== false || result.review_started !== false
    || result.release_authorized !== false) throw new HandoffUnavailableError();
  return Object.freeze({ state: "draft", route_profile: "offline_code_v2", case_version: 1,
    claimant_session_bound: true, case_created: true, identity_verified: false,
    relationship_verified: false, intake_started: false, review_started: false,
    release_authorized: false });
}

type Status = "ready" | "working" | "draft" | "unavailable" | "suspended" | "closed";

class SessionBridgeComposition {
  private readonly clock: () => number;
  private session: HandoffSession | null = null;
  private binding: SessionBinding | null = null;
  private sessionCleanup: (() => void) | null = null;
  private lifecycleCleanup: (() => void) | null = null;
  private bridge: ReturnType<typeof createPossessionHandoffBridge> | null = null;
  private bridgeDisposal: Promise<void> | null = null;
  private lastEvent: Event | null = null;
  private foreground = false;
  private closed = false;
  private generation = 0;
  private active = false;
  private activeCompletion: Promise<void> | null = null;
  private status: Status = "suspended";
  private draftAvailable = false;
  private readonly lifecycleListeners = new Set<(event: unknown) => void>();
  private readonly childLifecycle: BridgeInput["lifecycle"] = { subscribe: (listener) => {
    this.lifecycleListeners.add(listener);
    if (this.lastEvent) listener(this.lastEvent);
    return () => { this.lifecycleListeners.delete(listener); };
  } };

  constructor(private readonly input: Input) {
    this.clock = input.now ?? Date.now;
    this.initialize();
  }

  private initialize(): void {
    try {
      if (this.input.syntheticOnly !== true || this.input.productionRuntime !== false
        || this.input.session.syntheticOnly !== true || typeof this.input.session.subscribe !== "function"
        || typeof this.input.lifecycle.subscribe !== "function") throw new Error();
      this.sessionCleanup = this.input.session.subscribe((value) => { this.readSession(value); });
      if (typeof this.sessionCleanup !== "function" || !this.session || !this.binding || this.closed) throw new Error();
      this.lifecycleCleanup = this.input.lifecycle.subscribe((value) => { this.readLifecycle(value); });
      if (typeof this.lifecycleCleanup !== "function" || !this.lastEvent || this.closed) throw new Error();
      this.bridge = createPossessionHandoffBridge({ approved: true, syntheticOnly: true, productionRuntime: false,
        ...this.input.bridge, getSession: () => this.session, lifecycle: this.childLifecycle, now: this.clock });
      if (this.bridge.snapshot().status === "closed") throw new Error();
    } catch { this.close(); }
  }

  private detach(): void {
    const cleanups = [this.sessionCleanup, this.lifecycleCleanup];
    this.sessionCleanup = null; this.lifecycleCleanup = null;
    for (const cleanup of cleanups) {
      try { cleanup?.(); } catch { /* No adapter detail escapes. */ }
    }
    this.lifecycleListeners.clear();
  }

  private clearLocal(): void {
    this.generation += 1;
    this.draftAvailable = false;
    this.bridge?.cancel();
  }

  private close(): void {
    if (this.closed) return;
    this.closed = true; this.foreground = false; this.status = "closed";
    this.clearLocal(); this.detach();
    this.bridgeDisposal = this.bridge?.dispose() ?? Promise.resolve();
  }

  private readSession(value: unknown): void {
    if (this.closed) return;
    try {
      const next = validateSession(value, this.clock());
      if (!this.binding) this.binding = Object.freeze({ userId: next.userId, sessionId: next.sessionId,
        sessionVersion: next.sessionVersion });
      else if (!sameBinding(this.binding, next)) { this.close(); return; }
      this.session = next;
    } catch { this.close(); }
  }

  private readLifecycle(value: unknown): void {
    if (this.closed) return;
    try {
      const event = eventSchema.parse(value);
      if (this.lastEvent && event.sequence <= this.lastEvent.sequence) {
        if (event.sequence === this.lastEvent.sequence && event.state === this.lastEvent.state) return;
        this.close(); return;
      }
      this.lastEvent = Object.freeze(event);
      for (const listener of this.lifecycleListeners) listener(this.lastEvent);
      if (["locked", "session_ended", "disabled"].includes(event.state)) { this.close(); return; }
      if (event.state !== "foreground") {
        this.foreground = false; this.clearLocal(); this.status = "suspended";
      } else if (!this.foreground) {
        this.foreground = true; this.status = this.active ? "working" : "ready";
      }
    } catch { this.close(); }
  }

  private assertSession(): void {
    if (!this.binding || !this.session) throw new HandoffUnavailableError();
    try {
      const current = validateSession(this.session, this.clock());
      if (!sameBinding(this.binding, current)) throw new Error();
    } catch { this.close(); throw new HandoffUnavailableError(); }
  }

  private async run(operation: () => Promise<HandoffCompletion>): Promise<SessionBoundDraft> {
    if (this.closed || !this.foreground || this.active || !this.bridge) throw new HandoffUnavailableError();
    this.assertSession();
    const currentGeneration = this.generation;
    this.active = true; this.status = "working";
    let finish!: () => void;
    this.activeCompletion = new Promise<void>((resolve) => { finish = resolve; });
    try {
      const result = await operation();
      if (this.closed || !this.foreground || this.generation !== currentGeneration) throw new Error();
      this.assertSession();
      const draft = safeDraft(result);
      this.draftAvailable = true; this.status = "draft";
      return draft;
    } catch {
      if (!this.closed && this.foreground && this.generation === currentGeneration) this.status = "unavailable";
      throw new HandoffUnavailableError();
    } finally {
      this.active = false; this.activeCompletion = null; finish();
      if (!this.closed && this.foreground && this.generation !== currentGeneration) this.status = "ready";
    }
  }

  start(value: PossessionHandoffAttempt): Promise<SessionBoundDraft> {
    if (this.draftAvailable) return unavailable();
    return this.run(() => this.bridge!.start(value));
  }

  retryProof(): Promise<SessionBoundDraft> {
    if (this.draftAvailable) return unavailable();
    return this.run(() => this.bridge!.retryProof());
  }

  retryCompletion(): Promise<SessionBoundDraft> {
    if (this.draftAvailable) return unavailable();
    return this.run(() => this.bridge!.retryCompletion());
  }

  cancel(): void {
    if (this.closed) return;
    this.clearLocal(); this.status = this.foreground ? (this.active ? "working" : "ready") : "suspended";
  }

  async dispose(): Promise<void> {
    this.close();
    await this.activeCompletion;
    await this.bridgeDisposal;
  }

  snapshot() {
    return Object.freeze({ status: this.status, draft_available: this.draftAvailable,
      identity_verified: false as const, release_authorized: false as const });
  }
}

export function createClaimantSessionBridgeComposition(input: Input) {
  const approved = input.approved ?? CLAIMANT_SESSION_BRIDGE_COMPOSITION_APPROVED;
  if (!approved) return inert("disabled");
  const composition = new SessionBridgeComposition(input);
  return Object.freeze({
    start: (value: PossessionHandoffAttempt) => composition.start(value),
    retryProof: () => composition.retryProof(),
    retryCompletion: () => composition.retryCompletion(),
    cancel: () => { composition.cancel(); },
    dispose: () => composition.dispose(),
    snapshot: () => composition.snapshot(),
  });
}
