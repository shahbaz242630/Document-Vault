import { parseOfflineCodeSheetV2, type OfflineCodeSheetV2 } from "@vault/shared-types";

type ClaimAttempt = Readonly<{
  possession: OfflineCodeSheetV2 & Readonly<{ syntheticOnly: true; challengeIdempotencyKey: string;
    proofIdempotencyKey: string }>;
  issueIdempotencyKey: string;
  completionIdempotencyKey: string;
}>;

/** The narrow claimant runtime surface a screen may use; null whenever claims are unavailable. */
export type ClaimFlowHandle = Readonly<{
  activatePortal(key: string): Promise<void>;
  start(value: Readonly<{ attempt: ClaimAttempt; sessionAssertionIdempotencyKey: string }>): Promise<unknown>;
  isOpen(): boolean;
}>;

export type ClaimFlowStatus = "unavailable" | "ready" | "checking" | "claim_started"
  | "sheet_not_recognised" | "could_not_start" | "closed";

type Input = Readonly<{ handle: ClaimFlowHandle | null; newKey: () => string }>;

function isValueFreeDraft(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return draft.state === "draft" && draft.route_profile === "offline_code_v2" && draft.case_created === true
    && draft.claimant_session_bound === true && draft.identity_verified === false
    && draft.relationship_verified === false && draft.intake_started === false
    && draft.review_started === false && draft.release_authorized === false;
}

function snapshotOf(status: ClaimFlowStatus) {
  return Object.freeze({ status, claim_started: status === "claim_started",
    identity_verified: false as const, release_authorized: false as const });
}

export type ClaimFlowSnapshot = ReturnType<typeof snapshotOf>;

export function createClaimFlow(input: Input) {
  let status: ClaimFlowStatus = input.handle ? "ready" : "unavailable";
  let disposed = false;
  const listeners = new Set<(snapshot: ClaimFlowSnapshot) => void>();

  const set = (next: ClaimFlowStatus) => {
    if (disposed) return;
    status = next;
    const snapshot = snapshotOf(status);
    for (const listener of listeners) {
      try { listener(snapshot); } catch { /* A screen listener cannot change claim state. */ }
    }
  };

  async function submit(sheetText: string): Promise<void> {
    const handle = input.handle;
    if (!handle || disposed || (status !== "ready" && status !== "sheet_not_recognised")) return;
    let sheet: OfflineCodeSheetV2;
    try { sheet = parseOfflineCodeSheetV2(sheetText); } catch { set("sheet_not_recognised"); return; }
    set("checking");
    try {
      const attempt: ClaimAttempt = {
        possession: { ...sheet, syntheticOnly: true, challengeIdempotencyKey: input.newKey(),
          proofIdempotencyKey: input.newKey() },
        issueIdempotencyKey: input.newKey(), completionIdempotencyKey: input.newKey(),
      };
      await handle.activatePortal(input.newKey());
      const result = await handle.start({ attempt, sessionAssertionIdempotencyKey: input.newKey() });
      if (disposed) return;
      set(isValueFreeDraft(result) && handle.isOpen() ? "claim_started" : handle.isOpen() ? "could_not_start" : "closed");
    } catch {
      set(handle.isOpen() ? "could_not_start" : "closed");
    }
  }

  return Object.freeze({
    submit,
    snapshot: () => snapshotOf(status),
    subscribe(listener: (snapshot: ClaimFlowSnapshot) => void) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() { disposed = true; listeners.clear(); },
  });
}
