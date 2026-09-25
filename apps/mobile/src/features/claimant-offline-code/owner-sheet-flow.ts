import { OwnerOfflineCodeClientError, type OwnerOfflineCodeClient } from "./owner-offline-code-client";
import type { OwnerOfflineCodeSheet, OwnerOfflineCodeSheetInput } from "./owner-offline-code-sheet-factory";

/*
 * Slice 6H: one owner emergency sheet from generation to a confirmed print. The sheet lives only inside this
 * controller; the exposed state never carries the secret, the payload or the vault key. A sheet whose
 * registration was attempted is revoked, best effort, if the flow is abandoned or fails before the owner confirms
 * the print. JavaScript strings cannot be zeroed, so "wipe" here means every reference is dropped.
 */
export type OwnerSheetFlowStatus = "idle" | "generating" | "registering" | "needs_fresh_mfa" | "verifying_mfa"
  | "ready_to_print" | "printing" | "printed" | "done" | "failed";

export type OwnerSheetFlowState = Readonly<{
  status: OwnerSheetFlowStatus;
  expiresAt: string | null;
  mfaRejected: boolean;
  printFailed: boolean;
}>;

export type OwnerSheetFlowDeps = Readonly<{
  createSheet: (input: OwnerOfflineCodeSheetInput) => Promise<OwnerOfflineCodeSheet>;
  getOwnerId: () => Promise<string | null>;
  client: Pick<OwnerOfflineCodeClient, "register" | "revoke">;
  verifyFreshMfa: (code: string) => Promise<boolean>;
  renderSheetHtml: (sheet: OwnerOfflineCodeSheet) => string;
  print: (html: string) => Promise<void>;
  randomUUID: () => string;
  now?: () => Date;
}>;

const initial: OwnerSheetFlowState = Object.freeze({ status: "idle", expiresAt: null, mfaRejected: false,
  printFailed: false });

function createFlowCore(deps: OwnerSheetFlowDeps) {
  const core = {
    state: initial,
    sheet: null as OwnerOfflineCodeSheet | null,
    registerKey: null as string | null,
    registrationAttempted: false,
    controller: null as AbortController | null,
    epoch: 0,
    listeners: new Set<(value: OwnerSheetFlowState) => void>(),
    set(changes: Partial<OwnerSheetFlowState>) {
      core.state = Object.freeze({ ...core.state, ...changes });
      for (const listener of core.listeners) listener(core.state);
    },
    current: (value: number) => value === core.epoch,
    /** Drops the sheet and returns the record to revoke, if its registration was attempted. */
    clear() {
      const pending = core.registrationAttempted && core.sheet ? core.sheet.registration.locatorRecordId : null;
      core.controller?.abort(); core.controller = null;
      core.sheet = null; core.registerKey = null; core.registrationAttempted = false;
      core.epoch += 1;
      return pending;
    },
    async revokeQuietly(locatorRecordId: string | null) {
      if (!locatorRecordId) return;
      try { await deps.client.revoke(locatorRecordId, deps.randomUUID()); } catch { /* best effort */ }
    },
    async fail() {
      const pending = core.clear();
      core.set({ ...initial, status: "failed" });
      await core.revokeQuietly(pending);
    },
    async register(run: number) {
      if (!core.sheet || !core.registerKey) return;
      core.set({ status: "registering", mfaRejected: false });
      core.controller = new AbortController();
      core.registrationAttempted = true;
      try {
        await deps.client.register(core.sheet.registration, core.registerKey, core.controller.signal);
        if (core.current(run)) core.set({ status: "ready_to_print" });
      } catch (error) {
        if (!core.current(run)) return;
        if (error instanceof OwnerOfflineCodeClientError && error.kind === "fresh_mfa_required") {
          core.set({ status: "needs_fresh_mfa" });
          return;
        }
        await core.fail();
      }
    },
  };
  return core;
}

export function createOwnerSheetFlow(deps: OwnerSheetFlowDeps) {
  const core = createFlowCore(deps);
  const flow = {
    getState: () => core.state,
    subscribe(listener: (value: OwnerSheetFlowState) => void) {
      core.listeners.add(listener);
      return () => { core.listeners.delete(listener); };
    },
    async start() {
      if (core.state.status !== "idle" && core.state.status !== "failed" && core.state.status !== "done") return;
      core.clear(); const run = core.epoch;
      core.set({ ...initial, status: "generating" });
      try {
        const ownerId = await deps.getOwnerId();
        if (!ownerId) throw new Error("no owner");
        const created = await deps.createSheet({ ownerId, randomUUID: deps.randomUUID, now: deps.now });
        if (!core.current(run)) return;
        core.sheet = created; core.registerKey = deps.randomUUID();
        core.set({ expiresAt: created.expiresAt });
      } catch {
        if (core.current(run)) await core.fail();
        return;
      }
      await core.register(run);
    },
    async submitMfaCode(code: string) {
      if (core.state.status !== "needs_fresh_mfa") return;
      const run = core.epoch;
      core.set({ status: "verifying_mfa", mfaRejected: false });
      let verified = false;
      try { verified = await deps.verifyFreshMfa(code); } catch { verified = false; }
      if (!core.current(run)) return;
      if (!verified) { core.set({ status: "needs_fresh_mfa", mfaRejected: true }); return; }
      await core.register(run);
    },
    async print() {
      if ((core.state.status !== "ready_to_print" && core.state.status !== "printed") || !core.sheet) return;
      const run = core.epoch;
      core.set({ status: "printing", printFailed: false });
      try {
        await deps.print(deps.renderSheetHtml(core.sheet));
        if (core.current(run)) core.set({ status: "printed" });
      } catch {
        if (core.current(run)) core.set({ status: "ready_to_print", printFailed: true });
      }
    },
    confirmPrinted() {
      if (core.state.status !== "printed") return;
      const expiresAt = core.state.expiresAt;
      core.clear();
      core.set({ ...initial, status: "done", expiresAt });
    },
    /**
     * Backgrounding abandons the sheet, except while the system print dialog or the owner's authenticator app is
     * expected to take the foreground. A long absence still locks the vault, and a lock always abandons.
     */
    async handleAppState(next: string) {
      const status = core.state.status;
      if (next === "active" || status === "printing" || status === "needs_fresh_mfa"
        || status === "verifying_mfa") return;
      await flow.abandon();
    },
    /** Leaving, locking or signing out before confirmation revokes the unconfirmed sheet. */
    async abandon() {
      if (core.state.status === "done" || core.state.status === "idle") return;
      const pending = core.clear();
      core.set(initial);
      await core.revokeQuietly(pending);
    },
  };
  return flow;
}

export type OwnerSheetFlow = ReturnType<typeof createOwnerSheetFlow>;
