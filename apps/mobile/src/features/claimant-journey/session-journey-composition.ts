import { z } from "zod";

import { createClaimantSessionBridgeComposition } from "../claimant-handoff/session-bridge-composition";
import { createSyntheticClaimantPortalSessionClient,
  type SyntheticAuthenticatedSession } from "../claimant-session/portal-session-client";

export const CLAIMANT_SESSION_JOURNEY_COMPOSITION_APPROVED = false as const;

const uuidV4 = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
const authenticatedSchema = z.strictObject({
  syntheticOnly: z.literal(true), userId: uuidV4, sessionId: uuidV4,
  accessToken: z.string().min(1).max(8192).regex(/^[^\s,]+$/u),
  aal: z.literal("aal2"), recovery: z.literal(false),
  expiresAt: z.number().finite(), assuredAt: z.number().finite(),
});
const eventSchema = z.strictObject({
  sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  state: z.enum(["foreground", "inactive", "background", "locked", "session_ended", "disabled"]),
});

type PortalInput = Parameters<typeof createSyntheticClaimantPortalSessionClient>[0];
type BridgeInput = Parameters<typeof createClaimantSessionBridgeComposition>[0];
type Attempt = Parameters<ReturnType<typeof createClaimantSessionBridgeComposition>["start"]>[0];
type Source = Readonly<{ syntheticOnly: true; subscribe(listener: (value: unknown) => void): () => void }>;
type Event = z.infer<typeof eventSchema>;
type Status = "ready" | "suspended" | "working" | "active" | "draft" | "unavailable" | "closed";

type Input = Readonly<{
  approved?: boolean;
  syntheticOnly: true;
  productionRuntime: false;
  authenticated: Source;
  lifecycle: BridgeInput["lifecycle"];
  portal: Omit<PortalInput, "approved" | "syntheticOnly" | "productionRuntime" | "now">;
  bridge: BridgeInput["bridge"];
  now?: () => number;
}>;

type OperationInput = Readonly<{ attempt: Attempt; sessionAssertionIdempotencyKey: string }>;

export class ClaimantSessionJourneyUnavailableError extends Error {
  constructor() {
    super("Claimant session journey is unavailable.");
    this.name = "ClaimantSessionJourneyUnavailableError";
  }
}

function reject<T>(): Promise<T> {
  return Promise.reject(new ClaimantSessionJourneyUnavailableError());
}

function inert(status: "disabled" | "closed") {
  return Object.freeze({
    activatePortal: (_key: string) => reject(), retryActivation: () => reject(),
    start: (_value: OperationInput) => reject(), retryProof: (_key: string) => reject(),
    retryCompletion: (_key: string) => reject(), revokePortal: (_key: string) => reject<void>(),
    retryRevoke: () => reject<void>(), cancel() {}, dispose: () => Promise.resolve(),
    snapshot: () => Object.freeze({ status, portal_session_active: false as const,
      draft_available: false as const, identity_verified: false as const,
      relationship_verified: false as const, intake_started: false as const,
      review_started: false as const, release_authorized: false as const }),
  });
}

function validateAuthenticated(value: unknown, now: number): SyntheticAuthenticatedSession {
  const session = authenticatedSchema.parse(value);
  if (!Number.isFinite(now) || session.expiresAt <= now || session.assuredAt > now + 60_000
    || now - session.assuredAt > 600_000) throw new Error();
  return Object.freeze(session);
}

function sameAuthenticated(left: SyntheticAuthenticatedSession, right: SyntheticAuthenticatedSession): boolean {
  return left.userId === right.userId && left.sessionId === right.sessionId
    && left.accessToken === right.accessToken && left.aal === right.aal && left.recovery === right.recovery
    && left.expiresAt === right.expiresAt && left.assuredAt === right.assuredAt;
}

class SessionJourneyComposition {
  private readonly clock: () => number;
  private authenticated: SyntheticAuthenticatedSession | null = null;
  private binding: SyntheticAuthenticatedSession | null = null;
  private lastEvent: Event | null = null;
  private foreground = false;
  private closed = false;
  private active = false;
  private generation = 0;
  private status: Status = "suspended";
  private authCleanup: (() => void) | null = null;
  private lifecycleCleanup: (() => void) | null = null;
  private activeCompletion: Promise<void> | null = null;
  private disposal: Promise<void> = Promise.resolve();
  private portal: ReturnType<typeof createSyntheticClaimantPortalSessionClient> | null = null;
  private bridge: ReturnType<typeof createClaimantSessionBridgeComposition> | null = null;

  constructor(private readonly input: Input) {
    this.clock = input.now ?? Date.now;
    this.initialize();
  }

  private initialize(): void {
    try {
      if (this.input.syntheticOnly !== true || this.input.productionRuntime !== false
        || this.input.authenticated.syntheticOnly !== true
        || typeof this.input.authenticated.subscribe !== "function"
        || typeof this.input.lifecycle.subscribe !== "function") throw new Error();
      this.authCleanup = this.input.authenticated.subscribe((value) => { this.readAuthenticated(value); });
      this.lifecycleCleanup = this.input.lifecycle.subscribe((value) => { this.readLifecycle(value); });
      if (typeof this.authCleanup !== "function" || typeof this.lifecycleCleanup !== "function"
        || !this.authenticated || !this.binding || !this.lastEvent || this.closed) throw new Error();
      this.portal = createSyntheticClaimantPortalSessionClient({ approved: true, syntheticOnly: true,
        productionRuntime: false, ...this.input.portal, now: this.clock });
      if (this.portal.snapshot().status === "disabled") throw new Error();
      this.status = this.foreground ? "ready" : "suspended";
    } catch { this.closeNow(); }
  }

  private readAuthenticated(value: unknown): void {
    if (this.closed) return;
    try {
      const next = validateAuthenticated(value, this.clock());
      if (!this.binding) this.binding = next;
      else if (!sameAuthenticated(this.binding, next)) { this.closeNow(); return; }
      this.authenticated = next;
    } catch { this.closeNow(); }
  }

  private readLifecycle(value: unknown): void {
    if (this.closed) return;
    try {
      const event = eventSchema.parse(value);
      if (this.lastEvent && event.sequence <= this.lastEvent.sequence) {
        if (event.sequence === this.lastEvent.sequence && event.state === this.lastEvent.state) return;
        this.closeNow(); return;
      }
      this.lastEvent = Object.freeze(event);
      if (["locked", "session_ended", "disabled"].includes(event.state)) { this.closeNow(); return; }
      this.foreground = event.state === "foreground";
      if (!this.foreground) { this.clearTransient(); this.status = "suspended"; }
      else if (!this.active) this.status = this.portal?.snapshot().session_available ? "active" : "ready";
    } catch { this.closeNow(); }
  }

  private clearTransient(): void {
    this.generation += 1;
    this.portal?.cancel();
    this.bridge?.cancel();
  }

  private closeNow(): void {
    if (this.closed) return;
    this.closed = true; this.foreground = false; this.status = "closed";
    this.clearTransient();
    const cleanups = [this.authCleanup, this.lifecycleCleanup];
    this.authCleanup = null; this.lifecycleCleanup = null;
    for (const cleanup of cleanups) {
      try { cleanup?.(); } catch { /* Adapter detail never changes authority. */ }
    }
    const portal = this.portal; const bridge = this.bridge;
    this.portal = null; this.bridge = null;
    this.disposal = Promise.all([portal?.dispose() ?? Promise.resolve(),
      bridge?.dispose() ?? Promise.resolve()]).then(() => undefined);
  }

  private assertReady(): void {
    if (this.closed || !this.foreground || !this.authenticated || !this.binding || !this.portal) throw new Error();
    const current = validateAuthenticated(this.authenticated, this.clock());
    if (!sameAuthenticated(this.binding, current)) throw new Error();
  }

  private async run<T>(operation: (assertCurrent: () => void) => Promise<T>): Promise<T> {
    if (this.active) throw new ClaimantSessionJourneyUnavailableError();
    try { this.assertReady(); } catch { this.closeNow(); throw new ClaimantSessionJourneyUnavailableError(); }
    const currentGeneration = this.generation;
    const assertCurrent = () => {
      if (this.closed || !this.foreground || this.generation !== currentGeneration) throw new Error();
      this.assertReady();
    };
    this.active = true; this.status = "working";
    let finish!: () => void;
    this.activeCompletion = new Promise<void>((resolve) => { finish = resolve; });
    try {
      const result = await operation(assertCurrent);
      assertCurrent();
      return result;
    } catch {
      if (this.portal?.snapshot().status === "closed" || this.bridge?.snapshot().status === "closed") this.closeNow();
      else if (!this.closed && this.generation === currentGeneration) this.status = "unavailable";
      throw new ClaimantSessionJourneyUnavailableError();
    } finally {
      this.active = false; this.activeCompletion = null; finish();
      if (!this.closed && this.generation !== currentGeneration)
        this.status = this.foreground
          ? (this.portal?.snapshot().session_available ? "active" : "ready") : "suspended";
    }
  }

  private compose(): void {
    if (!this.portal || this.bridge) throw new Error();
    this.bridge = createClaimantSessionBridgeComposition({ approved: true, syntheticOnly: true,
      productionRuntime: false, session: this.portal.source, lifecycle: this.input.lifecycle,
      bridge: this.input.bridge, now: this.clock });
    if (this.bridge.snapshot().status === "closed") { this.closeNow(); throw new Error(); }
  }

  activatePortal(idempotencyKey: string) {
    return this.run(async (assertCurrent) => {
      if (!this.authenticated || this.bridge) throw new Error();
      const session = await this.portal!.activate({ authenticated: this.authenticated, idempotencyKey });
      assertCurrent(); this.compose(); this.status = "active"; return session;
    });
  }

  retryActivation() {
    return this.run(async (assertCurrent) => {
      const session = await this.portal!.retryActivation();
      assertCurrent(); this.compose(); this.status = "active"; return session;
    });
  }

  private executeBridge(idempotencyKey: string,
    operation: (bridge: NonNullable<SessionJourneyComposition["bridge"]>) => ReturnType<NonNullable<SessionJourneyComposition["bridge"]>["start"]>) {
    return this.run(async (assertCurrent) => {
      if (!this.bridge) throw new Error();
      await this.portal!.assert(idempotencyKey); assertCurrent();
      const result = await operation(this.bridge); assertCurrent();
      this.status = "draft"; return result;
    });
  }

  start(value: OperationInput) {
    return this.executeBridge(value.sessionAssertionIdempotencyKey, (bridge) => bridge.start(value.attempt));
  }

  retryProof(idempotencyKey: string) {
    return this.executeBridge(idempotencyKey, (bridge) => bridge.retryProof());
  }

  retryCompletion(idempotencyKey: string) {
    return this.executeBridge(idempotencyKey, (bridge) => bridge.retryCompletion());
  }

  async revokePortal(idempotencyKey: string): Promise<void> {
    this.bridge?.cancel();
    await this.run(async (assertCurrent) => {
      await this.portal!.revoke(idempotencyKey); assertCurrent();
    });
    this.closeNow();
  }

  async retryRevoke(): Promise<void> {
    await this.run(async (assertCurrent) => {
      await this.portal!.retryRevoke(); assertCurrent();
    });
    this.closeNow();
  }

  cancel(): void {
    if (this.closed) return;
    this.clearTransient();
    this.status = this.foreground
      ? (this.portal?.snapshot().session_available ? "active" : "ready") : "suspended";
  }

  async dispose(): Promise<void> {
    this.closeNow();
    await this.activeCompletion;
    await this.disposal;
  }

  snapshot() {
    const portalActive = this.portal?.snapshot().session_available === true;
    const draftAvailable = this.bridge?.snapshot().draft_available === true;
    return Object.freeze({ status: this.status, portal_session_active: portalActive,
      draft_available: draftAvailable, identity_verified: false as const,
      relationship_verified: false as const, intake_started: false as const,
      review_started: false as const, release_authorized: false as const });
  }
}

export function createClaimantSessionJourneyComposition(input: Input) {
  const approved = input.approved ?? CLAIMANT_SESSION_JOURNEY_COMPOSITION_APPROVED;
  if (!approved) return inert("disabled");
  try {
    const journey = new SessionJourneyComposition(input);
    if (journey.snapshot().status === "closed") return inert("closed");
    return Object.freeze({ activatePortal: journey.activatePortal.bind(journey),
      retryActivation: journey.retryActivation.bind(journey), start: journey.start.bind(journey),
      retryProof: journey.retryProof.bind(journey), retryCompletion: journey.retryCompletion.bind(journey),
      revokePortal: journey.revokePortal.bind(journey), retryRevoke: journey.retryRevoke.bind(journey),
      cancel: journey.cancel.bind(journey), dispose: journey.dispose.bind(journey),
      snapshot: journey.snapshot.bind(journey) });
  } catch { return inert("closed"); }
}
