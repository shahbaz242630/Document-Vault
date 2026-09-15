import { createClaimantNativeSigningBoundary } from "../claimant-handoff/native-signing-boundary";
import { createClaimantHostedIdentityBoundary } from "../claimant-session/hosted-identity-boundary";
import { createClaimantSessionJourneyComposition } from "./session-journey-composition";

export const CLAIMANT_RUNTIME_FOUNDATION_APPROVED = false as const;

type IdentityInput = Parameters<typeof createClaimantHostedIdentityBoundary>[0];
type SigningInput = Parameters<typeof createClaimantNativeSigningBoundary>[0];
type JourneyInput = Parameters<typeof createClaimantSessionJourneyComposition>[0];
type StartInput = Parameters<ReturnType<typeof createClaimantSessionJourneyComposition>["start"]>[0];
type Input = Readonly<{ approved?: boolean; syntheticOnly: true; productionRuntime: false;
  identity: Omit<IdentityInput, "approved" | "syntheticOnly" | "productionRuntime">;
  signing: Omit<SigningInput, "approved" | "syntheticOnly" | "productionRuntime">;
  journey: Omit<JourneyInput, "approved" | "syntheticOnly" | "productionRuntime" | "authenticated" | "bridge"> & {
    bridge: Omit<JourneyInput["bridge"], "signer"> } }>;

export class ClaimantRuntimeFoundationUnavailableError extends Error {
  constructor() { super("Claimant runtime foundation is unavailable."); this.name = "ClaimantRuntimeFoundationUnavailableError"; }
}

function reject<T>(): Promise<T> { return Promise.reject(new ClaimantRuntimeFoundationUnavailableError()); }
function safeSnapshot(status: string, portal = false, draft = false) {
  return Object.freeze({ status, portal_session_active: portal, draft_available: draft,
    identity_verified: false as const, relationship_verified: false as const,
    intake_started: false as const, review_started: false as const, release_authorized: false as const });
}
function inert(status: "disabled" | "closed") {
  return Object.freeze({ activatePortal: (_key: string) => reject<void>(), retryActivation: () => reject<void>(),
    start: (_value: StartInput) => reject(), retryProof: (_key: string) => reject(),
    retryCompletion: (_key: string) => reject(), revokePortal: (_key: string) => reject<void>(),
    retryRevoke: () => reject<void>(), cancel() {}, dispose: () => Promise.resolve(),
    snapshot: () => safeSnapshot(status) });
}

class RuntimeFoundation {
  private readonly identity: ReturnType<typeof createClaimantHostedIdentityBoundary>;
  private readonly signing: ReturnType<typeof createClaimantNativeSigningBoundary>;
  private readonly journey: ReturnType<typeof createClaimantSessionJourneyComposition>;
  private closed = false;
  private disposed = false;

  constructor(input: Input) {
    if (input.syntheticOnly !== true || input.productionRuntime !== false) throw new Error();
    const identity = createClaimantHostedIdentityBoundary({ approved: true, syntheticOnly: true,
      productionRuntime: false, ...input.identity });
    const signing = createClaimantNativeSigningBoundary({ approved: true, syntheticOnly: true,
      productionRuntime: false, ...input.signing });
    const journey = createClaimantSessionJourneyComposition({ approved: true, syntheticOnly: true,
      productionRuntime: false, ...input.journey, authenticated: identity.source,
      bridge: { ...input.journey.bridge, signer: signing.signer } });
    if (identity.snapshot().status !== "ready" || signing.snapshot().status !== "ready"
      || journey.snapshot().status === "closed") {
      void Promise.all([journey.dispose(), identity.dispose(), signing.dispose()]); throw new Error();
    }
    this.identity = identity; this.signing = signing; this.journey = journey;
  }

  private async delegate<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closed) throw new ClaimantRuntimeFoundationUnavailableError();
    try { return await operation(); }
    catch { if (this.journey.snapshot().status === "closed") this.closed = true;
      throw new ClaimantRuntimeFoundationUnavailableError(); }
  }
  activatePortal(key: string) { return this.delegate(async () => { await this.journey.activatePortal(key); }); }
  retryActivation() { return this.delegate(async () => { await this.journey.retryActivation(); }); }
  start(value: StartInput) { return this.delegate(() => this.journey.start(value)); }
  retryProof(key: string) { return this.delegate(() => this.journey.retryProof(key)); }
  retryCompletion(key: string) { return this.delegate(() => this.journey.retryCompletion(key)); }
  revokePortal(key: string) { return this.delegate(async () => {
    await this.journey.revokePortal(key); this.closed = true;
  }); }
  retryRevoke() { return this.delegate(async () => {
    await this.journey.retryRevoke(); this.closed = true;
  }); }
  cancel(): void { if (!this.closed) this.journey.cancel(); }
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true; this.closed = true;
    await Promise.all([this.journey.dispose(), this.identity.dispose(), this.signing.dispose()]);
  }
  snapshot() {
    if (this.closed) return safeSnapshot("closed");
    const snapshot = this.journey.snapshot();
    return safeSnapshot(snapshot.status, snapshot.portal_session_active, snapshot.draft_available);
  }
}

export function createClaimantRuntimeFoundation(input: Input) {
  const approved = input.approved ?? CLAIMANT_RUNTIME_FOUNDATION_APPROVED;
  if (!approved) return inert("disabled");
  try {
    const runtime = new RuntimeFoundation(input);
    return Object.freeze({ activatePortal: runtime.activatePortal.bind(runtime),
      retryActivation: runtime.retryActivation.bind(runtime), start: runtime.start.bind(runtime),
      retryProof: runtime.retryProof.bind(runtime), retryCompletion: runtime.retryCompletion.bind(runtime),
      revokePortal: runtime.revokePortal.bind(runtime), retryRevoke: runtime.retryRevoke.bind(runtime),
      cancel: runtime.cancel.bind(runtime), dispose: runtime.dispose.bind(runtime),
      snapshot: runtime.snapshot.bind(runtime) });
  } catch { return inert("closed"); }
}
