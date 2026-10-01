import sodium from "libsodium-wrappers-sumo";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { openOwnerSheetCopy, sealOwnerSheetCopy } from "@/features/vault/owner-sheet-copy-crypto";

import { OwnerOfflineCodeClientError, type OwnerOfflineCodeSheetSummary } from "./owner-offline-code-client";
import { createOwnerSheetCopyStore, type OwnerSheetCopySealer } from "./owner-sheet-copy-store";
import { createOwnerSheetDetailFlow, type OwnerSheetDetailDeps } from "./owner-sheet-detail-flow";
import { ownerSheetDetailView } from "./owner-sheet-detail-view-model";
import { renderOwnerSheetHtml } from "./owner-sheet-html";
import { ownerSheetListView } from "./owner-sheet-list-view-model";

vi.mock("expo-file-system", () => ({ Directory: class {}, File: class {}, Paths: {} }));

const owner = "10000000-0000-4000-8000-000000000001";
const ids = { live: "3f9a1c2b-0000-4000-8000-000000000001", other: "7d0e4b11-0000-4000-8000-000000000002" };
const copy = Object.freeze({ locatorRecordId: ids.live, sheetPayload: "SKQ2.synthetic-detail-payload",
  printedLocator: "SK2-L-ABCD-EFGH", printedSecret: "SK2-S-WXYZ-1234", expiresAt: "2027-09-25T09:00:00.000Z" });
const summary = (id: string, status: OwnerOfflineCodeSheetSummary["status"] = "active"): OwnerOfflineCodeSheetSummary =>
  ({ locatorRecordId: id, status, issuedAt: "2026-09-25T09:00:00.000Z", expiresAt: "2027-09-25T09:00:00.000Z",
    revokedAt: status === "revoked" ? "2026-09-30T09:00:00.000Z" : null });

let key: Uint8Array;
beforeAll(async () => { await sodium.ready; key = sodium.randombytes_buf(32); });

function device(disk = new Map<string, string>()) {
  const locked = { value: false };
  const sealer: OwnerSheetCopySealer = {
    seal: async (input) => sealOwnerSheetCopy({ ...input, key }),
    open: async (input) => {
      if (locked.value) throw new Error("Vault session is not ready yet.");
      return openOwnerSheetCopy({ ...input, key });
    },
  };
  const files = { read: async (name: string) => disk.get(name) ?? null,
    write: async (name: string, contents: string) => { disk.set(name, contents); },
    remove: async (name: string) => { disk.delete(name); } };
  return { disk, locked, store: createOwnerSheetCopyStore({ files, sealer }) };
}

function detail(id: string, place: ReturnType<typeof device>, sheets: OwnerOfflineCodeSheetSummary[],
  changes: Partial<OwnerSheetDetailDeps> = {}) {
  let keys = 0;
  const deps = {
    locatorRecordId: id,
    client: { list: vi.fn(async () => sheets),
      revoke: vi.fn(async (locatorRecordId: string, _key: string) => {
        sheets = sheets.map((sheet) => sheet.locatorRecordId === locatorRecordId ? summary(locatorRecordId, "revoked") : sheet);
        return { locatorRecordId, status: "revoked" as const, replayed: false }; }) },
    copies: place.store,
    exporter: { canPickFolder: true, print: vi.fn(async () => true),
      save: vi.fn(async (_html: string, _id: string, _mode: string) =>
        ({ status: "saved" as const, fileName: "Sanduqkin-emergency-sheet-3F9A1C.pdf", folder: "Download" })) },
    renderSheetHtml: vi.fn(renderOwnerSheetHtml),
    getOwnerId: vi.fn(async () => owner),
    isLocked: () => place.locked.value,
    verifyFreshMfa: vi.fn(async (code: string) => code === "123456"),
    randomUUID: () => `90000000-0000-4000-8000-00000000000${(keys += 1)}`,
  };
  const all = { ...deps, ...changes } as typeof deps;
  return { deps: all, flow: createOwnerSheetDetailFlow(all), sheets: () => sheets };
}

describe("owner sheet detail", () => {
  it("views and saves the same sheet again after an app restart, without exposing it in state", async () => {
    const place = device();
    await place.store.save(owner, copy);
    const first = detail(ids.live, place, [summary(ids.live)]);
    await first.flow.load();
    expect(first.flow.getState()).toMatchObject({ status: "active", copy: "available" });
    expect(first.flow.revealedSheet()).toBeNull();
    first.flow.reveal();
    const shown = first.flow.revealedSheet();
    first.flow.close();
    expect(first.flow.revealedSheet()).toBeNull();

    const restarted = detail(ids.live, device(place.disk), [summary(ids.live)]);
    await restarted.flow.load(); restarted.flow.reveal();
    expect(restarted.flow.revealedSheet()).toEqual(shown);
    expect(shown).toEqual({ sheetPayload: copy.sheetPayload, printedLocator: copy.printedLocator,
      printedSecret: copy.printedSecret });
    await restarted.flow.save();
    expect(restarted.deps.exporter.save).toHaveBeenCalledExactlyOnceWith(expect.stringContaining(copy.printedSecret),
      ids.live, "folder");
    expect(restarted.flow.getState()).toMatchObject({ status: "active", saveResult: { status: "saved" } });
    expect(JSON.stringify(restarted.flow.getState())).not.toMatch(/SKQ2|SK2-S|SK2-L/u);
  });

  it("says honestly when this device has no copy, and never creates one", async () => {
    const { flow, deps } = detail(ids.live, device(), [summary(ids.live)]);
    await flow.load();
    expect(flow.getState()).toMatchObject({ status: "active", copy: "missing" });
    flow.reveal(); await flow.save(); await flow.print();
    expect(flow.revealedSheet()).toBeNull();
    expect(deps.exporter.save).not.toHaveBeenCalled();
    expect(deps.exporter.print).not.toHaveBeenCalled();
    expect(ownerSheetDetailView(flow.getState())).toMatchObject({ actions: [],
      dangerAction: { action: "revoke" }, body: expect.stringContaining("doesn't have a copy") });
  });

  it.each(["revoked", "expired"] as const)("shows a %s sheet as unusable and deletes its local copy", async (status) => {
    const place = device();
    await place.store.save(owner, copy);
    const { flow, deps } = detail(ids.live, place, [summary(ids.live, status)]);
    await flow.load();
    expect(flow.getState()).toMatchObject({ status, copy: null });
    expect(place.disk.size).toBe(0);
    flow.reveal(); await flow.save(); flow.requestRevoke();
    expect(flow.revealedSheet()).toBeNull();
    expect(deps.exporter.save).not.toHaveBeenCalled();
    expect(ownerSheetDetailView(flow.getState())).toMatchObject({ actions: [], dangerAction: null,
      badge: { tone: status } });
  });

  it("opens only the owner's own sheets: another account's record is not found", async () => {
    const place = device();
    await place.store.save(owner, copy);
    const { flow, deps } = detail(ids.live, place, [summary(ids.other)]);
    await flow.load();
    expect(flow.getState().status).toBe("not_found");
    expect(deps.exporter.save).not.toHaveBeenCalled();
  });

  it("opens nothing while the vault is locked", async () => {
    const place = device();
    await place.store.save(owner, copy);
    place.locked.value = true;
    const { flow, deps } = detail(ids.live, place, [summary(ids.live)]);
    await flow.load();
    expect(flow.getState().status).toBe("locked");
    expect(deps.client.list).not.toHaveBeenCalled();
  });

  it("revokes only after confirmation and a fresh TOTP code, with one key, and leaves other sheets alone", async () => {
    const place = device();
    await place.store.save(owner, copy);
    await place.store.save(owner, { ...copy, locatorRecordId: ids.other });
    const { flow, deps, sheets } = detail(ids.live, place, [summary(ids.live), summary(ids.other)]);
    deps.client.revoke.mockRejectedValueOnce(new OwnerOfflineCodeClientError("fresh_mfa_required"));
    await flow.load();
    flow.requestRevoke();
    expect(deps.client.revoke).not.toHaveBeenCalled();
    expect(ownerSheetDetailView(flow.getState())).toMatchObject({ dangerAction: { action: "confirm_revoke" } });
    await flow.confirmRevoke();
    expect(flow.getState().status).toBe("needs_fresh_mfa");
    await flow.submitMfaCode("000000");
    expect(flow.getState()).toMatchObject({ status: "needs_fresh_mfa", mfaRejected: true });
    await flow.submitMfaCode("123456");
    expect(flow.getState()).toMatchObject({ status: "revoked", justRevoked: true, summary: { status: "revoked" } });
    const keys = deps.client.revoke.mock.calls.map(([, key]) => key);
    expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]);
    expect([...place.disk.keys()]).toEqual([`${owner}.${ids.other}.sheetcopy`]);
    expect(sheets().map((sheet) => sheet.status)).toEqual(["revoked", "active"]);
  });

  it("keeps the sheet active when the owner backs out of revoking or the revoke fails", async () => {
    const place = device();
    await place.store.save(owner, copy);
    const { flow, deps } = detail(ids.live, place, [summary(ids.live)]);
    await flow.load();
    flow.requestRevoke(); flow.cancelRevoke();
    expect(flow.getState().status).toBe("active");
    deps.client.revoke.mockRejectedValueOnce(new OwnerOfflineCodeClientError("failed"));
    flow.requestRevoke(); await flow.confirmRevoke();
    expect(flow.getState()).toMatchObject({ status: "active", revokeFailed: true, copy: "available" });
  });

  it("asks for a code when the session needs a step-up, then loads", async () => {
    const place = device();
    await place.store.save(owner, copy);
    const { flow, deps } = detail(ids.live, place, [summary(ids.live)]);
    deps.client.list.mockRejectedValueOnce(new OwnerOfflineCodeClientError("unauthorized"));
    await flow.load();
    expect(flow.getState().status).toBe("needs_fresh_mfa");
    await flow.submitMfaCode("123456");
    expect(flow.getState()).toMatchObject({ status: "active", copy: "available" });
  });
});

describe("owner sheet status display", () => {
  it("gives each status its own badge and offers actions on active sheets only", () => {
    const view = ownerSheetListView({ status: "ready", mfaRejected: false, loadFailure: null,
      sheets: [summary(ids.live), summary(ids.other, "revoked"), { ...summary(ids.other, "expired"),
        locatorRecordId: "5e000000-0000-4000-8000-000000000003" }] });
    expect(view.rows.map((row) => [row.statusLabel, row.badge.tone, row.actions])).toEqual([
      ["Active", "active", ["view", "save", "revoke"]], ["Revoked", "revoked", []], ["Expired", "expired", []]]);
    expect(view.rows[0]).not.toHaveProperty("canRevoke");
  });
});
