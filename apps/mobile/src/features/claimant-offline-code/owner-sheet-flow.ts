import { OwnerOfflineCodeClientError, type OwnerOfflineCodeClient } from "./owner-offline-code-client";
import type { OwnerOfflineCodeSheet, OwnerOfflineCodeSheetInput } from "./owner-offline-code-sheet-factory";
import {
  toOwnerSheetCopy,
  type OwnerSheetCopy,
  type OwnerSheetCopyPort,
  type OwnerSheetExportPort,
  type OwnerSheetSaveMode,
  type OwnerSheetSaveResult,
} from "./owner-sheet-copy";
import { ownerSheetReference } from "./owner-sheet-reference";

/*
 * PDF-first emergency sheets (owner decisions 2026-10-01): one sheet from generation to active. The sheet becomes
 * active once it is registered AND the owner's encrypted copy is stored on this device; from then on nothing in
 * this flow revokes it, so leaving, backgrounding, locking or a cancelled save never cancels a saved sheet. Before
 * that point, a sheet whose registration was attempted is revoked, best effort, if the flow is abandoned or fails.
 * Saving and printing reuse the same in-memory sheet, so a retry never creates or registers another one. The
 * exposed state never carries the secret or the payload. JavaScript strings cannot be zeroed, so "wipe" here means
 * every reference is dropped.
 */
export type OwnerSheetFlowStatus = "idle" | "generating" | "registering" | "needs_fresh_mfa" | "verifying_mfa"
  | "storing" | "ready" | "saving" | "printing" | "failed";

export type OwnerSheetFlowState = Readonly<{
  status: OwnerSheetFlowStatus;
  reference: string | null;
  expiresAt: string | null;
  mfaRejected: boolean;
  saveResult: OwnerSheetSaveResult | null;
  printFailed: boolean;
  canPickFolder: boolean;
}>;

export type OwnerSheetFlowDeps = Readonly<{
  createSheet: (input: OwnerOfflineCodeSheetInput) => Promise<OwnerOfflineCodeSheet>;
  getOwnerId: () => Promise<string | null>;
  client: Pick<OwnerOfflineCodeClient, "register" | "revoke">;
  verifyFreshMfa: (code: string) => Promise<boolean>;
  copies: Pick<OwnerSheetCopyPort, "save">;
  exporter: Pick<OwnerSheetExportPort, "save" | "print" | "canPickFolder">;
  renderSheetHtml: (sheet: OwnerSheetCopy) => string;
  randomUUID: () => string;
  now?: () => Date;
}>;

const committedStatuses: readonly OwnerSheetFlowStatus[] = ["ready", "saving", "printing"];

function createFlowCore(deps: OwnerSheetFlowDeps) {
  const initial: OwnerSheetFlowState = Object.freeze({ status: "idle", reference: null, expiresAt: null,
    mfaRejected: false, saveResult: null, printFailed: false, canPickFolder: deps.exporter.canPickFolder });
  const core = {
    initial,
    state: initial,
    sheet: null as OwnerSheetCopy | null,
    pendingSheet: null as OwnerOfflineCodeSheet | null,
    ownerId: null as string | null,
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
    committed: () => committedStatuses.includes(core.state.status),
    /** Drops the sheet; returns the record to revoke when it was registered but never became active. */
    clear() {
      const pending = !core.committed() && core.registrationAttempted && core.pendingSheet
        ? core.pendingSheet.registration.locatorRecordId : null;
      core.controller?.abort(); core.controller = null;
      core.sheet = null; core.pendingSheet = null; core.ownerId = null; core.registerKey = null;
      core.registrationAttempted = false; core.epoch += 1;
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
    async store(run: number) {
      const sheet = core.pendingSheet; const ownerId = core.ownerId;
      if (!sheet || !ownerId) return;
      core.set({ status: "storing" });
      try {
        const copy = toOwnerSheetCopy(sheet);
        await deps.copies.save(ownerId, copy);
        if (!core.current(run)) return;
        core.sheet = copy;
        core.set({ status: "ready", reference: ownerSheetReference(copy.locatorRecordId) });
      } catch {
        // No copy means the sheet could never be shown or saved again, so it must not stay active.
        if (core.current(run)) await core.fail();
      }
    },
    async register(run: number) {
      if (!core.pendingSheet || !core.registerKey) return;
      core.set({ status: "registering", mfaRejected: false });
      core.controller = new AbortController();
      core.registrationAttempted = true;
      try {
        await deps.client.register(core.pendingSheet.registration, core.registerKey, core.controller.signal);
        if (core.current(run)) await core.store(run);
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
      if (core.state.status !== "idle" && core.state.status !== "failed") return;
      core.clear(); const run = core.epoch;
      core.set({ ...core.initial, status: "generating" });
      try {
        const ownerId = await deps.getOwnerId();
        if (!ownerId) throw new Error("no owner");
        const created = await deps.createSheet({ ownerId, randomUUID: deps.randomUUID, now: deps.now });
        if (!core.current(run)) return;
        core.pendingSheet = created; core.ownerId = ownerId; core.registerKey = deps.randomUUID();
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
    /** Saves the same sheet as a PDF; retrying after a cancel or failure never creates another sheet. */
    async save(mode: OwnerSheetSaveMode = "folder") {
      if (core.state.status !== "ready" || !core.sheet) return;
      const run = core.epoch; const sheet = core.sheet;
      core.set({ status: "saving", saveResult: null, printFailed: false });
      const result = await deps.exporter.save(deps.renderSheetHtml(sheet), sheet.locatorRecordId, mode);
      if (core.current(run)) core.set({ status: "ready", saveResult: result });
    },
    async print() {
      if (core.state.status !== "ready" || !core.sheet) return;
      const run = core.epoch;
      core.set({ status: "printing", printFailed: false, saveResult: null });
      const printed = await deps.exporter.print(deps.renderSheetHtml(core.sheet));
      if (core.current(run)) core.set({ status: "ready", printFailed: !printed });
    },
    /**
     * Before the sheet is active, backgrounding abandons it, except while the owner's authenticator app is expected
     * to take the foreground. An active sheet is never abandoned by backgrounding.
     */
    async handleAppState(next: string) {
      const status = core.state.status;
      if (next === "active" || core.committed() || status === "idle" || status === "failed"
        || status === "needs_fresh_mfa" || status === "verifying_mfa") return;
      await flow.abandon();
    },
    /** Leaving, locking or signing out drops the sheet; only a sheet that never became active is revoked. */
    async abandon() {
      if (core.state.status === "idle") return;
      const pending = core.clear();
      core.set(core.initial);
      await core.revokeQuietly(pending);
    },
  };
  return flow;
}

export type OwnerSheetFlow = ReturnType<typeof createOwnerSheetFlow>;
