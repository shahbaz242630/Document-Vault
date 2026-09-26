import {
  OwnerOfflineCodeClientError,
  type OwnerOfflineCodeClient,
  type OwnerOfflineCodeSheetSummary,
} from "./owner-offline-code-client";

/*
 * Slice 6J: "My emergency sheets". The owner sees their sheets (dates and status only) and can revoke an active
 * one. Revoking needs a fresh MFA step-up; a retry after the step-up reuses the same idempotency key, so one
 * confirmed revoke is one server-side revocation however many times it is retried.
 */
export type OwnerSheetListStatus = "loading" | "ready" | "confirming" | "revoking" | "needs_fresh_mfa"
  | "verifying_mfa" | "failed";

export type OwnerSheetListState = Readonly<{
  status: OwnerSheetListStatus;
  sheets: readonly OwnerOfflineCodeSheetSummary[];
  /** The sheet being revoked, while a revoke is being confirmed or carried out. */
  selected: string | null;
  mfaRejected: boolean;
  revokeFailed: boolean;
  revoked: boolean;
}>;

export type OwnerSheetListDeps = Readonly<{
  client: Pick<OwnerOfflineCodeClient, "list" | "revoke">;
  verifyFreshMfa: (code: string) => Promise<boolean>;
  randomUUID: () => string;
}>;

const initial: OwnerSheetListState = Object.freeze({ status: "loading", sheets: Object.freeze([]), selected: null,
  mfaRejected: false, revokeFailed: false, revoked: false });

export function createOwnerSheetListFlow(deps: OwnerSheetListDeps) {
  let state = initial;
  let revokeKey: string | null = null;
  let controller: AbortController | null = null;
  let epoch = 0;
  const listeners = new Set<(value: OwnerSheetListState) => void>();

  const set = (changes: Partial<OwnerSheetListState>) => {
    state = Object.freeze({ ...state, ...changes });
    for (const listener of listeners) {
      try { listener(state); } catch { /* A screen listener cannot change the list. */ }
    }
  };
  const begin = () => {
    controller?.abort();
    controller = new AbortController();
    epoch += 1;
    return { run: epoch, signal: controller.signal };
  };
  const current = (run: number) => run === epoch;

  async function load(): Promise<void> {
    if (state.status === "revoking" || state.status === "verifying_mfa") return;
    const { run, signal } = begin();
    set({ status: "loading", selected: null, mfaRejected: false });
    try {
      const sheets = await deps.client.list(signal);
      if (current(run)) set({ status: "ready", sheets });
    } catch {
      if (current(run)) set({ status: "failed", sheets: Object.freeze([]) });
    }
  }

  async function revoke(): Promise<void> {
    const selected = state.selected;
    if (!selected || !revokeKey) return;
    const { run, signal } = begin();
    set({ status: "revoking", mfaRejected: false, revokeFailed: false, revoked: false });
    try {
      await deps.client.revoke(selected, revokeKey, signal);
      if (!current(run)) return;
      revokeKey = null;
      const sheets = await deps.client.list(signal).catch(() => state.sheets.map((sheet) =>
        sheet.locatorRecordId === selected ? Object.freeze({ ...sheet, status: "revoked" as const }) : sheet));
      if (current(run)) set({ status: "ready", sheets: Object.freeze([...sheets]), selected: null, revoked: true });
    } catch (error) {
      if (!current(run)) return;
      if (error instanceof OwnerOfflineCodeClientError && error.kind === "fresh_mfa_required") {
        set({ status: "needs_fresh_mfa" });
        return;
      }
      revokeKey = null;
      set({ status: "ready", selected: null, revokeFailed: true });
    }
  }

  return Object.freeze({
    load,
    getState: () => state,
    subscribe(listener: (value: OwnerSheetListState) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    /** Asks the owner to confirm revoking one of their active sheets. */
    requestRevoke(locatorRecordId: string): void {
      const sheet = state.sheets.find((entry) => entry.locatorRecordId === locatorRecordId);
      if (state.status !== "ready" || !sheet || sheet.status !== "active") return;
      set({ status: "confirming", selected: locatorRecordId, revokeFailed: false, revoked: false });
    },
    cancelRevoke(): void {
      if (state.status !== "confirming" && state.status !== "needs_fresh_mfa") return;
      controller?.abort(); epoch += 1; revokeKey = null;
      set({ status: "ready", selected: null, mfaRejected: false });
    },
    async confirmRevoke(): Promise<void> {
      if (state.status !== "confirming") return;
      revokeKey = deps.randomUUID();
      await revoke();
    },
    async submitMfaCode(code: string): Promise<void> {
      if (state.status !== "needs_fresh_mfa") return;
      const run = ++epoch;
      set({ status: "verifying_mfa", mfaRejected: false });
      const verified = await deps.verifyFreshMfa(code).catch(() => false);
      if (!current(run)) return;
      if (!verified) { set({ status: "needs_fresh_mfa", mfaRejected: true }); return; }
      await revoke();
    },
    /** Leaving the screen stops any request, drops a pending revoke and resets; late results are ignored. */
    close(): void {
      controller?.abort(); controller = null; epoch += 1; revokeKey = null;
      state = initial;
    },
  });
}

export type OwnerSheetListFlow = ReturnType<typeof createOwnerSheetListFlow>;
