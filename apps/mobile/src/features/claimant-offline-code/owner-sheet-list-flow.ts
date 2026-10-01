import {
  OwnerOfflineCodeClientError,
  type OwnerOfflineCodeClient,
  type OwnerOfflineCodeSheetSummary,
} from "./owner-offline-code-client";

/*
 * Slice 6J, PDF-first since 2026-10-01: "My emergency sheets". The owner sees their sheets (dates and status only)
 * and opens one to view, save or revoke it on its own screen (owner-sheet-detail-flow.ts); the list itself
 * changes nothing.
 *
 * Loading needs an AAL2 owner session with an active claimant session control. When the API says either is missing
 * (403 or 401) the owner is asked for a TOTP step-up, which also activates the session control, and the list is
 * loaded once more; a second refusal is reported as a session problem rather than another prompt.
 */
export type OwnerSheetListStatus = "loading" | "ready" | "needs_fresh_mfa" | "verifying_mfa" | "failed";

/** Why the list could not be loaded: no answer from the API, a session it still refused, or anything else. */
export type OwnerSheetListLoadFailure = "unreachable" | "session" | "server";

export type OwnerSheetListState = Readonly<{
  status: OwnerSheetListStatus;
  sheets: readonly OwnerOfflineCodeSheetSummary[];
  mfaRejected: boolean;
  loadFailure: OwnerSheetListLoadFailure | null;
}>;

export type OwnerSheetListDeps = Readonly<{
  client: Pick<OwnerOfflineCodeClient, "list">;
  verifyFreshMfa: (code: string) => Promise<boolean>;
}>;

const initial: OwnerSheetListState = Object.freeze({ status: "loading", sheets: Object.freeze([]),
  mfaRejected: false, loadFailure: null });
const sessionRefused = (error: unknown) => error instanceof OwnerOfflineCodeClientError
  && (error.kind === "fresh_mfa_required" || error.kind === "unauthorized");
const loadFailureOf = (error: unknown): OwnerSheetListLoadFailure => sessionRefused(error) ? "session"
  : error instanceof OwnerOfflineCodeClientError && error.kind === "unreachable" ? "unreachable" : "server";

export function createOwnerSheetListFlow(deps: OwnerSheetListDeps) {
  let state = initial;
  let controller: AbortController | null = null;
  let epoch = 0;
  const listeners = new Set<(value: OwnerSheetListState) => void>();

  const set = (changes: Partial<OwnerSheetListState>) => {
    state = Object.freeze({ ...state, ...changes });
    for (const listener of listeners) {
      try { listener(state); } catch { /* A screen listener cannot change the list. */ }
    }
  };

  async function load(afterStepUp = false): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    const run = ++epoch; const signal = controller.signal;
    set({ status: "loading", mfaRejected: false, loadFailure: null });
    try {
      const sheets = await deps.client.list(signal);
      if (run === epoch) set({ status: "ready", sheets });
    } catch (error) {
      if (run !== epoch) return;
      if (sessionRefused(error) && !afterStepUp) set({ status: "needs_fresh_mfa", sheets: Object.freeze([]) });
      else set({ status: "failed", sheets: Object.freeze([]), loadFailure: loadFailureOf(error) });
    }
  }

  return Object.freeze({
    async load(): Promise<void> {
      if (state.status === "verifying_mfa") return;
      await load();
    },
    getState: () => state,
    subscribe(listener: (value: OwnerSheetListState) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async submitMfaCode(code: string): Promise<void> {
      if (state.status !== "needs_fresh_mfa") return;
      const run = ++epoch;
      set({ status: "verifying_mfa", mfaRejected: false });
      const verified = await deps.verifyFreshMfa(code).catch(() => false);
      if (run !== epoch) return;
      if (!verified) { set({ status: "needs_fresh_mfa", mfaRejected: true }); return; }
      await load(true);
    },
    /** Leaving the screen stops any request and resets; late results are ignored. */
    close(): void {
      controller?.abort(); controller = null; epoch += 1;
      state = initial;
    },
  });
}

export type OwnerSheetListFlow = ReturnType<typeof createOwnerSheetListFlow>;
