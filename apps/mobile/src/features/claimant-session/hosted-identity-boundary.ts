import { z } from "zod";

export const CLAIMANT_HOSTED_IDENTITY_BOUNDARY_APPROVED = false as const;

const uuidV4 = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
const eventSchema = z.strictObject({ syntheticOnly: z.literal(true), status: z.literal("authenticated"),
  userId: uuidV4, sessionId: uuidV4, accessToken: z.string().min(1).max(8192).regex(/^[^\s,]+$/u),
  aal: z.literal("aal2"), recovery: z.literal(false), expiresAt: z.number().finite(),
  assuredAt: z.number().finite(), issuer: z.string().max(300), audience: z.literal("authenticated") });

export type HostedIdentityProvider = Readonly<{ syntheticOnly: true;
  subscribe(listener: (value: unknown) => void): () => void }>;
type Session = Readonly<Omit<z.infer<typeof eventSchema>, "status" | "issuer" | "audience">>;
type Input = Readonly<{ approved?: boolean; syntheticOnly: true; productionRuntime: false;
  expectedIssuer: string; provider: HostedIdentityProvider; now?: () => number }>;

export class ClaimantHostedIdentityUnavailableError extends Error {
  constructor() { super("Claimant hosted identity is unavailable."); this.name = "ClaimantHostedIdentityUnavailableError"; }
}

function disabled() {
  return Object.freeze({ source: Object.freeze({ syntheticOnly: true as const,
    subscribe: (_listener: (value: unknown) => void) => () => undefined }), dispose: () => Promise.resolve(),
    snapshot: () => Object.freeze({ status: "disabled" as const, session_available: false as const }) });
}

function exactOrigin(value: string): string {
  const url = new URL(value);
  if (value.length > 300 || url.protocol !== "https:" || url.origin !== value) throw new Error();
  return value;
}

function sameSession(left: Session, right: Session): boolean {
  return left.userId === right.userId && left.sessionId === right.sessionId
    && left.accessToken === right.accessToken && left.aal === right.aal && left.recovery === right.recovery
    && left.expiresAt === right.expiresAt && left.assuredAt === right.assuredAt;
}

class HostedIdentityBoundary {
  private readonly clock: () => number;
  private readonly issuer: string;
  private current: Session | null = null;
  private binding: Session | null = null;
  private closed = false;
  private cleanup: (() => void) | null = null;
  private readonly listeners = new Set<(value: unknown) => void>();

  constructor(private readonly input: Input) {
    this.clock = input.now ?? Date.now; this.issuer = exactOrigin(input.expectedIssuer);
    if (input.syntheticOnly !== true || input.productionRuntime !== false || input.provider.syntheticOnly !== true
      || typeof input.provider.subscribe !== "function") throw new Error();
    const cleanup = input.provider.subscribe((value) => { this.read(value); });
    if (typeof cleanup !== "function") throw new Error();
    this.cleanup = cleanup;
    if (!this.current || this.closed) {
      try { cleanup(); } catch { /* Broken provider cleanup has no authority. */ }
      this.cleanup = null; throw new Error();
    }
  }

  readonly source = Object.freeze({ syntheticOnly: true as const, subscribe: (listener: (value: unknown) => void) => {
    if (this.closed || typeof listener !== "function") return () => undefined;
    this.listeners.add(listener); listener(this.current);
    return () => { this.listeners.delete(listener); };
  } });

  private read(value: unknown): void {
    if (this.closed) return;
    try {
      const event = eventSchema.parse(value); const now = this.clock();
      if (event.issuer !== this.issuer || !Number.isFinite(now) || event.expiresAt <= now
        || event.assuredAt > now + 60_000 || now - event.assuredAt > 600_000) throw new Error();
      const session = Object.freeze({ syntheticOnly: true as const, userId: event.userId,
        sessionId: event.sessionId, accessToken: event.accessToken, aal: event.aal,
        recovery: event.recovery, expiresAt: event.expiresAt, assuredAt: event.assuredAt });
      if (!this.binding) this.binding = session;
      else if (!sameSession(this.binding, session)) { this.close(); return; }
      this.current = session;
      for (const listener of this.listeners) listener(session);
    } catch { this.close(); }
  }

  private close(): void {
    if (this.closed) return;
    this.closed = true; this.current = null; this.binding = null;
    const cleanup = this.cleanup; this.cleanup = null;
    try { cleanup?.(); } catch { /* Provider detail never changes authority. */ }
    for (const listener of this.listeners) {
      try { listener(Object.freeze({ unavailable: true })); } catch { /* Subscriber detail stays private. */ }
    }
    this.listeners.clear();
  }

  async dispose(): Promise<void> { this.close(); }
  snapshot() { return Object.freeze({ status: this.closed ? "closed" as const : "ready" as const,
    session_available: !this.closed && this.current !== null }); }
}

export function createClaimantHostedIdentityBoundary(input: Input) {
  const approved = input.approved ?? CLAIMANT_HOSTED_IDENTITY_BOUNDARY_APPROVED;
  if (!approved) return disabled();
  try {
    const boundary = new HostedIdentityBoundary(input);
    return Object.freeze({ source: boundary.source, dispose: boundary.dispose.bind(boundary),
      snapshot: boundary.snapshot.bind(boundary) });
  } catch { return Object.freeze({ ...disabled(), snapshot: () => Object.freeze({ status: "closed" as const,
    session_available: false as const }) }); }
}
