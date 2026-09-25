import { z } from "zod";

export const CLAIMANT_PORTAL_SESSION_CLIENT_APPROVED = false as const;

const uuidV4 = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
const authenticatedSessionSchema = z.strictObject({
  syntheticOnly: z.literal(true), userId: uuidV4, sessionId: uuidV4,
  accessToken: z.string().min(1).max(8192).regex(/^[^\s,]+$/u),
  aal: z.literal("aal2"), recovery: z.literal(false),
  expiresAt: z.number().finite(), assuredAt: z.number().finite(),
});
const baseResult = { context: z.literal("claimant_portal"), sessionVersion: z.number().int().positive() };
const activateResultSchema = z.strictObject({ ...baseResult,
  displacedPrevious: z.boolean().optional(), replayed: z.boolean().optional() });
const assertResultSchema = z.strictObject(baseResult);
const revokeResultSchema = z.strictObject({ ...baseResult, revoked: z.literal(true), replayed: z.boolean().optional() });
const EMPTY_BODY = "{}";

export type SyntheticAuthenticatedSession = Readonly<z.infer<typeof authenticatedSessionSchema>>;
export type ClaimantPortalSession = Readonly<Omit<SyntheticAuthenticatedSession, "syntheticOnly"> & {
  context: "claimant_portal"; sessionVersion: number;
}>;
export type PortalSessionSend = (url: string, request: Readonly<{
  method: "POST"; headers: Readonly<Record<string, string>>; body: string; signal: AbortSignal;
}>) => Promise<Response>;

type Action = "activate" | "assert" | "revoke";
type Request = Readonly<{ action: Action; url: string; headers: Readonly<Record<string, string>>; body: "{}" }>;
type Binding = Pick<SyntheticAuthenticatedSession, "userId" | "sessionId">;
type PendingRetry = Readonly<{ action: "activate" | "revoke"; request: Request;
  authenticated: SyntheticAuthenticatedSession; binding: Binding }>;
type Input = Readonly<{ approved?: boolean; syntheticOnly: true; productionRuntime: false;
  apiOrigin: string; claimantOrigin: string; send: PortalSessionSend; now?: () => number }>;
type Client = Readonly<{
  activate(value: Readonly<{ authenticated: SyntheticAuthenticatedSession;
    idempotencyKey: string }>): Promise<ClaimantPortalSession>;
  assert(idempotencyKey: string): Promise<ClaimantPortalSession>;
  revoke(idempotencyKey: string): Promise<void>;
  retryActivation(): Promise<ClaimantPortalSession>;
  retryRevoke(): Promise<void>;
  cancel(): void;
  dispose(): Promise<void>;
  source: Readonly<{ syntheticOnly: true; subscribe(listener: (value: unknown) => void): () => void }>;
  snapshot(): Readonly<{ status: string; session_available: boolean; retry_available: boolean }>;
}>;

export class ClaimantPortalSessionUnavailableError extends Error {
  constructor(readonly retryable = false) {
    super("Claimant portal session is unavailable.");
    this.name = "ClaimantPortalSessionUnavailableError";
  }
}

class AmbiguousDispatchError extends Error {
  constructor(readonly request: Request) { super("Ambiguous claimant portal session dispatch."); }
}

function assertOrigin(value: string): void {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value || value.length > 300) throw new Error();
}

function validateAuthenticated(value: unknown, now: number): SyntheticAuthenticatedSession {
  const session = authenticatedSessionSchema.parse(value);
  if (!Number.isFinite(now) || session.expiresAt <= now || session.assuredAt > now + 60_000
    || now - session.assuredAt > 600_000) throw new Error();
  return Object.freeze(session);
}

function sameBinding(left: Binding, right: Binding): boolean {
  return left.userId === right.userId && left.sessionId === right.sessionId;
}

function disabledClient(): Client {
  const reject = () => Promise.reject(new ClaimantPortalSessionUnavailableError());
  return Object.freeze({ activate: (_value) => reject(), assert: (_key) => reject(), revoke: (_key) => reject(),
    retryActivation: () => reject(), retryRevoke: () => reject(), cancel() {}, dispose: () => Promise.resolve(),
    source: Object.freeze({ syntheticOnly: true as const, subscribe: () => () => undefined }),
    snapshot: () => Object.freeze({ status: "disabled" as const, session_available: false as const,
      retry_available: false as const }) });
}

function sessionFrom(authenticated: SyntheticAuthenticatedSession, sessionVersion: number): ClaimantPortalSession {
  return Object.freeze({ userId: authenticated.userId, sessionId: authenticated.sessionId,
    accessToken: authenticated.accessToken, aal: authenticated.aal, recovery: authenticated.recovery,
    expiresAt: authenticated.expiresAt, assuredAt: authenticated.assuredAt,
    context: "claimant_portal" as const, sessionVersion });
}

function authenticatedFrom(session: ClaimantPortalSession): SyntheticAuthenticatedSession {
  return Object.freeze({ syntheticOnly: true, userId: session.userId, sessionId: session.sessionId,
    accessToken: session.accessToken, aal: session.aal, recovery: session.recovery,
    expiresAt: session.expiresAt, assuredAt: session.assuredAt });
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new Error());
    void promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
  });
}

class PortalSessionClient {
  private readonly clock: () => number;
  private activeSession: ClaimantPortalSession | null = null;
  private pendingRetry: PendingRetry | null = null;
  private active = false;
  private closed = false;
  private generation = 0;
  private activeCompletion: Promise<void> | null = null;
  private activeController: AbortController | null = null;
  private status: "ready" | "working" | "active" | "unavailable" | "closed" = "ready";
  private readonly listeners = new Set<(value: unknown) => void>();

  constructor(private readonly input: Input) {
    this.clock = input.now ?? Date.now;
    assertOrigin(input.apiOrigin); assertOrigin(input.claimantOrigin);
    if (input.apiOrigin === input.claimantOrigin || input.syntheticOnly !== true
      || input.productionRuntime !== false || typeof input.send !== "function") throw new Error();
  }

  readonly source = Object.freeze({ syntheticOnly: true as const, subscribe: (listener: (value: unknown) => void) => {
    if (this.closed || typeof listener !== "function") return () => undefined;
    this.listeners.add(listener);
    if (this.activeSession) listener(this.activeSession);
    return () => { this.listeners.delete(listener); };
  } });

  private request(action: Action, token: string, idempotencyKey: string): Request {
    return Object.freeze({ action, url: `${this.input.apiOrigin}/claimant/portal/session/${action}`,
      headers: Object.freeze({ Authorization: `Bearer ${token}`, Origin: this.input.claimantOrigin,
        "Content-Type": "application/json", "Idempotency-Key": uuidV4.parse(idempotencyKey) }),
      body: EMPTY_BODY });
  }

  private async dispatch(request: Request, signal: AbortSignal): Promise<unknown> {
    let response: Response;
    try { response = await abortable(this.input.send(request.url, { method: "POST", headers: request.headers,
      body: EMPTY_BODY, signal }), signal); }
    catch { throw new AmbiguousDispatchError(request); }
    const length = Number(response.headers.get("Content-Length") ?? "0");
    if (!response.ok || response.status !== 200 || (length && (!Number.isInteger(length) || length > 4096))
      || response.headers.get("Access-Control-Allow-Origin") !== this.input.claimantOrigin
      || response.headers.get("Cache-Control") !== "no-store"
      || response.headers.get("X-Content-Type-Options") !== "nosniff"
      || !response.headers.get("Vary")?.split(",").map((value) => value.trim()).includes("Origin")
      || !response.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) throw new Error();
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > 4096) throw new Error();
    return z.strictObject({ result: z.unknown() }).parse(JSON.parse(text)).result;
  }

  private notify(value: unknown): void {
    for (const listener of this.listeners) {
      try { listener(value); } catch { /* Subscriber detail never changes client authority. */ }
    }
  }

  private validateCurrent(authenticated: SyntheticAuthenticatedSession): void {
    const current = validateAuthenticated(authenticated, this.clock());
    if (this.activeSession && !sameBinding(this.activeSession, current)) { this.close(); throw new Error(); }
  }

  private async run<T>(operation: (signal: AbortSignal, assertCurrent: () => void) => Promise<T>, retryable = false): Promise<T> {
    if (this.closed || this.active) throw new ClaimantPortalSessionUnavailableError();
    const currentGeneration = this.generation;
    const controller = new AbortController();
    this.active = true; this.activeController = controller; this.status = "working";
    let finish!: () => void;
    this.activeCompletion = new Promise<void>((resolve) => { finish = resolve; });
    const assertCurrent = () => {
      if (this.closed || this.generation !== currentGeneration) throw new Error();
    };
    try {
      const result = await operation(controller.signal, assertCurrent);
      assertCurrent();
      return result;
    } catch (error) {
      if (!this.closed && this.generation === currentGeneration) this.status = "unavailable";
      throw new ClaimantPortalSessionUnavailableError(retryable && error instanceof AmbiguousDispatchError);
    } finally {
      this.active = false; this.activeController = null; this.activeCompletion = null; finish();
      if (!this.closed && this.generation !== currentGeneration) this.status = this.activeSession ? "active" : "ready";
    }
  }

  activate(value: Readonly<{ authenticated: SyntheticAuthenticatedSession; idempotencyKey: string }>) {
    return this.run(async (signal, assertCurrent) => {
      const authenticated = validateAuthenticated(value.authenticated, this.clock());
      if (this.activeSession || this.pendingRetry) throw new Error();
      const request = this.request("activate", authenticated.accessToken, value.idempotencyKey);
      try {
        const result = activateResultSchema.parse(await this.dispatch(request, signal));
        assertCurrent();
        this.pendingRetry = null;
        this.activeSession = sessionFrom(authenticated, result.sessionVersion);
        this.status = "active"; this.notify(this.activeSession);
        return this.activeSession;
      } catch (error) {
        if (error instanceof AmbiguousDispatchError) {
          assertCurrent();
          this.pendingRetry = Object.freeze({ action: "activate", request: error.request,
            authenticated, binding: authenticated });
        }
        throw error;
      }
    }, true);
  }

  assert(idempotencyKey: string) {
    return this.run(async (signal, assertCurrent) => {
      if (!this.activeSession) throw new Error();
      const authenticated = validateAuthenticated(authenticatedFrom(this.activeSession), this.clock());
      this.validateCurrent(authenticated);
      const result = assertResultSchema.parse(await this.dispatch(
        this.request("assert", authenticated.accessToken, idempotencyKey), signal));
      assertCurrent();
      if (result.sessionVersion !== this.activeSession.sessionVersion) { this.close(); throw new Error(); }
      this.status = "active";
      return this.activeSession;
    });
  }

  revoke(idempotencyKey: string) {
    return this.run(async (signal, assertCurrent) => {
      if (!this.activeSession) throw new Error();
      if (this.pendingRetry) throw new Error();
      const authenticated = validateAuthenticated(authenticatedFrom(this.activeSession), this.clock());
      const request = this.request("revoke", authenticated.accessToken, idempotencyKey);
      try {
        const result = revokeResultSchema.parse(await this.dispatch(request, signal));
        assertCurrent();
        // The server's revoke advances the control row exactly once and reports that new version.
        if (result.sessionVersion !== this.activeSession.sessionVersion + 1) throw new Error();
        this.pendingRetry = null; this.activeSession = null; this.status = "ready"; this.notify(null);
      } catch (error) {
        if (error instanceof AmbiguousDispatchError) {
          assertCurrent();
          this.pendingRetry = Object.freeze({ action: "revoke", request: error.request,
            authenticated, binding: authenticated });
        }
        throw error;
      }
    }, true);
  }

  retryActivation(): Promise<ClaimantPortalSession> { return this.retry("activate"); }
  retryRevoke(): Promise<void> { return this.retry("revoke"); }

  private retry(action: "activate"): Promise<ClaimantPortalSession>;
  private retry(action: "revoke"): Promise<void>;
  private retry(action: "activate" | "revoke"): Promise<ClaimantPortalSession | void> {
    return this.run(async (signal, assertCurrent) => {
      const pending = this.pendingRetry;
      if (!pending || pending.action !== action) throw new Error();
      const authenticated = validateAuthenticated(pending.authenticated, this.clock());
      if (!sameBinding(pending.binding, authenticated)) { this.close(); throw new Error(); }
      const result = action === "activate"
        ? activateResultSchema.parse(await this.dispatch(pending.request, signal))
        : revokeResultSchema.parse(await this.dispatch(pending.request, signal));
      assertCurrent();
      this.pendingRetry = null;
      if (action === "activate") {
        this.activeSession = sessionFrom(authenticated, result.sessionVersion);
        this.status = "active"; this.notify(this.activeSession); return this.activeSession;
      }
      if (!this.activeSession || result.sessionVersion !== this.activeSession.sessionVersion + 1) throw new Error();
      this.activeSession = null; this.status = "ready"; this.notify(null); return undefined;
    }, true);
  }

  cancel(): void {
    if (this.closed) return;
    this.generation += 1; this.pendingRetry = null; this.activeController?.abort();
  }

  private close(): void {
    if (this.closed) return;
    this.closed = true; this.generation += 1; this.pendingRetry = null; this.activeSession = null;
    this.status = "closed"; this.notify(null); this.listeners.clear(); this.activeController?.abort();
  }

  async dispose(): Promise<void> {
    this.close();
    await this.activeCompletion;
  }

  snapshot() {
    return Object.freeze({ status: this.status, session_available: this.activeSession !== null,
      retry_available: this.pendingRetry !== null });
  }
}

export function createSyntheticClaimantPortalSessionClient(input: Input): Client {
  const approved = input.approved ?? CLAIMANT_PORTAL_SESSION_CLIENT_APPROVED;
  if (!approved) return disabledClient();
  try {
    const client = new PortalSessionClient(input);
    return Object.freeze({ activate: client.activate.bind(client), assert: client.assert.bind(client),
      revoke: client.revoke.bind(client), retryActivation: client.retryActivation.bind(client),
      retryRevoke: client.retryRevoke.bind(client), cancel: client.cancel.bind(client),
      dispose: client.dispose.bind(client), source: client.source, snapshot: client.snapshot.bind(client) });
  } catch { return disabledClient(); }
}
