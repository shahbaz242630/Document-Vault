import {
  OwnerOfflineCodeClientError,
  type OwnerOfflineCodeClient,
  type OwnerOfflineCodeSheetSummary,
} from "./owner-offline-code-client";
import type {
  OwnerSheetCopy,
  OwnerSheetCopyPort,
  OwnerSheetExportPort,
  OwnerSheetSaveMode,
  OwnerSheetSaveResult,
} from "./owner-sheet-copy";

/*
 * PDF-first sheets: one of the owner's sheets, opened from "My emergency sheets". The server's list decides the
 * status; a sheet is shown, saved or printed only while the server lists it as active AND this device holds the
 * owner's copy AND the vault is unlocked to open it. A missing copy is reported, never regenerated. Revoked and
 * expired sheets lose their local copy. Revoking needs a confirmation and a fresh TOTP check; a retry reuses the
 * same idempotency key. The copy stays inside this controller: the state carries no secret or payload, and the
 * screen reads it only through revealedSheet() while the owner has chosen to view it.
 */
export type OwnerSheetDetailStatus = "loading" | "active" | "revoked" | "expired" | "not_found" | "failed"
  | "locked" | "saving" | "printing" | "confirming_revoke" | "revoking" | "needs_fresh_mfa" | "verifying_mfa";

export type OwnerSheetCopyStatus = "available" | "missing" | "unreadable" | null;

export type OwnerSheetDetailState = Readonly<{
  status: OwnerSheetDetailStatus;
  summary: OwnerOfflineCodeSheetSummary | null;
  copy: OwnerSheetCopyStatus;
  revealed: boolean;
  saveResult: OwnerSheetSaveResult | null;
  printFailed: boolean;
  mfaRejected: boolean;
  revokeFailed: boolean;
  justRevoked: boolean;
  canPickFolder: boolean;
}>;

export type OwnerSheetDetailDeps = Readonly<{
  locatorRecordId: string;
  client: Pick<OwnerOfflineCodeClient, "list" | "revoke">;
  copies: Pick<OwnerSheetCopyPort, "load" | "remove">;
  exporter: Pick<OwnerSheetExportPort, "save" | "print" | "canPickFolder">;
  renderSheetHtml: (sheet: OwnerSheetCopy) => string;
  getOwnerId: () => Promise<string | null>;
  isLocked: () => boolean;
  verifyFreshMfa: (code: string) => Promise<boolean>;
  randomUUID: () => string;
}>;

function createDetailCore(deps: OwnerSheetDetailDeps) {
  const initial: OwnerSheetDetailState = Object.freeze({ status: "loading", summary: null, copy: null,
    revealed: false, saveResult: null, printFailed: false, mfaRejected: false, revokeFailed: false,
    justRevoked: false, canPickFolder: deps.exporter.canPickFolder });
  const listeners = new Set<(value: OwnerSheetDetailState) => void>();
  const core = {
    initial, listeners,
    state: initial,
    sheet: null as OwnerSheetCopy | null,
    ownerId: null as string | null,
    revokeKey: null as string | null,
    pending: "load" as "load" | "revoke",
    epoch: 0,
    set(changes: Partial<OwnerSheetDetailState>) {
      core.state = Object.freeze({ ...core.state, ...changes });
      for (const listener of listeners) {
        try { listener(core.state); } catch { /* A screen listener cannot change the sheet. */ }
      }
    },
    usable: () => core.state.status === "active" && core.state.copy === "available" && core.sheet !== null,
    async load(afterStepUp = false): Promise<void> {
      const run = ++core.epoch; core.sheet = null;
      core.set({ ...initial, status: "loading" });
      if (deps.isLocked()) { core.set({ status: "locked" }); return; }
      try {
        const ownerId = core.ownerId = await deps.getOwnerId();
        if (!ownerId) throw new Error("no owner");
        const summary = (await deps.client.list()).find((entry) => entry.locatorRecordId === deps.locatorRecordId);
        if (run !== core.epoch) return;
        if (!summary) { core.set({ status: "not_found" }); return; }
        if (summary.status !== "active") {
          await deps.copies.remove(ownerId, summary.locatorRecordId);
          if (run === core.epoch) core.set({ status: summary.status, summary });
          return;
        }
        if (deps.isLocked()) { core.set({ status: "locked", summary }); return; }
        const loaded = await deps.copies.load(ownerId, summary.locatorRecordId);
        if (run !== core.epoch) return;
        if (loaded.status === "available") core.sheet = loaded.copy;
        core.set({ status: "active", summary, copy: loaded.status });
      } catch (error) {
        if (run !== core.epoch) return;
        if (sessionRefused(error) && !afterStepUp) { core.pending = "load"; core.set({ status: "needs_fresh_mfa" }); return; }
        core.set({ status: "failed" });
      }
    },
    async revoke(): Promise<void> {
      if (!core.revokeKey || !core.state.summary) return;
      const run = ++core.epoch; const summary = core.state.summary; const revokeKey = core.revokeKey;
      core.set({ status: "revoking", mfaRejected: false, revokeFailed: false });
      try {
        await deps.client.revoke(summary.locatorRecordId, revokeKey);
        if (run !== core.epoch) return;
        core.revokeKey = null; core.sheet = null;
        if (core.ownerId) await deps.copies.remove(core.ownerId, summary.locatorRecordId);
        core.set({ status: "revoked", copy: null, revealed: false, justRevoked: true,
          summary: Object.freeze({ ...summary, status: "revoked" as const, revokedAt: new Date().toISOString() }) });
      } catch (error) {
        if (run !== core.epoch) return;
        if (error instanceof OwnerOfflineCodeClientError && error.kind === "fresh_mfa_required") {
          core.pending = "revoke"; core.set({ status: "needs_fresh_mfa" }); return;
        }
        core.revokeKey = null;
        core.set({ status: "active", revokeFailed: true });
      }
    },
  };
  return core;
}

const sessionRefused = (error: unknown) => error instanceof OwnerOfflineCodeClientError
  && (error.kind === "fresh_mfa_required" || error.kind === "unauthorized");

export function createOwnerSheetDetailFlow(deps: OwnerSheetDetailDeps) {
  const core = createDetailCore(deps);
  return Object.freeze({
    load: () => core.load(),
    getState: () => core.state,
    subscribe(listener: (value: OwnerSheetDetailState) => void) {
      core.listeners.add(listener);
      return () => { core.listeners.delete(listener); };
    },
    /** The sheet to draw on screen, only while the owner has chosen to view an active, available copy. */
    revealedSheet(): Pick<OwnerSheetCopy, "sheetPayload" | "printedLocator" | "printedSecret"> | null {
      const sheet = core.sheet;
      return core.state.revealed && core.usable() && sheet
        ? { sheetPayload: sheet.sheetPayload, printedLocator: sheet.printedLocator, printedSecret: sheet.printedSecret }
        : null;
    },
    reveal(): void { if (core.usable()) core.set({ revealed: true }); },
    hide(): void { if (core.state.revealed) core.set({ revealed: false }); },
    async save(mode: OwnerSheetSaveMode = "folder"): Promise<void> {
      const sheet = core.sheet;
      if (!core.usable() || !sheet) return;
      const run = core.epoch;
      core.set({ status: "saving", saveResult: null, printFailed: false });
      const result = await deps.exporter.save(deps.renderSheetHtml(sheet), sheet.locatorRecordId, mode);
      if (run === core.epoch) core.set({ status: "active", saveResult: result });
    },
    async print(): Promise<void> {
      const sheet = core.sheet;
      if (!core.usable() || !sheet) return;
      const run = core.epoch;
      core.set({ status: "printing", printFailed: false, saveResult: null });
      const printed = await deps.exporter.print(deps.renderSheetHtml(sheet));
      if (run === core.epoch) core.set({ status: "active", printFailed: !printed });
    },
    requestRevoke(): void {
      if (core.state.status !== "active") return;
      core.set({ status: "confirming_revoke", revealed: false, revokeFailed: false, saveResult: null });
    },
    cancelRevoke(): void {
      const status = core.state.status;
      if (status !== "confirming_revoke" && !(status === "needs_fresh_mfa" && core.pending === "revoke")) return;
      core.epoch += 1; core.revokeKey = null;
      core.set({ status: "active", mfaRejected: false });
    },
    async confirmRevoke(): Promise<void> {
      if (core.state.status !== "confirming_revoke") return;
      core.revokeKey = deps.randomUUID();
      await core.revoke();
    },
    async submitMfaCode(code: string): Promise<void> {
      if (core.state.status !== "needs_fresh_mfa") return;
      const run = ++core.epoch;
      core.set({ status: "verifying_mfa", mfaRejected: false });
      const verified = await deps.verifyFreshMfa(code).catch(() => false);
      if (run !== core.epoch) return;
      if (!verified) { core.set({ status: "needs_fresh_mfa", mfaRejected: true }); return; }
      if (core.pending === "revoke") await core.revoke();
      else await core.load(true);
    },
    /** Leaving or locking drops the decrypted copy at once; late results are ignored. */
    close(): void {
      core.epoch += 1; core.revokeKey = null; core.sheet = null;
      core.state = core.initial;
    },
  });
}

export type OwnerSheetDetailFlow = ReturnType<typeof createOwnerSheetDetailFlow>;
