import { describe, expect, it, vi } from "vitest";

import { createOwnerOfflineCodeClient, OwnerOfflineCodeClientError } from "./owner-offline-code-client";
import type { OwnerOfflineCodeSheet } from "./owner-offline-code-sheet-factory";
import type { OwnerSheetCopy } from "./owner-sheet-copy-store";
import type { OwnerSheetSaveResult } from "./owner-sheet-export";
import { createOwnerSheetFlow, type OwnerSheetFlowDeps } from "./owner-sheet-flow";

const ids = { owner: "10000000-0000-4000-8000-000000000001", locator: "20000000-0000-4000-8000-000000000002",
  key: "30000000-0000-4000-8000-000000000003" };
const sheet: OwnerOfflineCodeSheet = Object.freeze({ sheetPayload: "SKQ2.synthetic-payload",
  printedLocator: "SK2-L-LOCATOR", printedSecret: "SK2-S-SECRET", expiresAt: "2027-09-25T09:00:00.000Z",
  registration: Object.freeze({ locatorRecordId: ids.locator, grantId: "40000000-0000-4000-8000-000000000004",
    publicLocator: "SK2-L-LOCATOR", locatorCommitment: "c", proofPublicKey: "p", recordBindingDigest: "d",
    kdfSalt: "s", wrapNonce: "n", wrapCiphertext: "x", wrapAssociatedDataDigest: "a",
    issuedAt: "2026-09-25T09:00:00.000Z", expiresAt: "2027-09-25T09:00:00.000Z" }) });
const saved: OwnerSheetSaveResult = { status: "saved", fileName: "Sanduqkin-emergency-sheet-200000.pdf",
  folder: "Download" };

function deps(changes: Partial<Omit<OwnerSheetFlowDeps, "client">> = {}) {
  let counter = 0;
  const base = {
    createSheet: vi.fn(async () => sheet),
    getOwnerId: vi.fn(async () => ids.owner),
    client: { register: vi.fn(async () => ({ locatorRecordId: ids.locator, status: "active" as const, replayed: false })),
      revoke: vi.fn(async () => ({ locatorRecordId: ids.locator, status: "revoked" as const, replayed: false })) },
    verifyFreshMfa: vi.fn(async (code: string) => code === "123456"),
    copies: { save: vi.fn(async (_owner: string, _copy: OwnerSheetCopy) => undefined) },
    exporter: { canPickFolder: true, print: vi.fn(async (_html: string) => true),
      save: vi.fn(async (_html: string, _id: string, _mode: string): Promise<OwnerSheetSaveResult> => saved) },
    renderSheetHtml: vi.fn((value: OwnerSheetCopy) => `<html>${value.printedSecret}</html>`),
    randomUUID: vi.fn(() => `50000000-0000-4000-8000-${String((counter += 1)).padStart(12, "0")}`),
  };
  return { ...base, ...changes } as typeof base;
}

describe("owner emergency sheet flow (PDF first)", () => {
  it("generates, registers once, stores the encrypted copy, then is active without exposing the sheet", async () => {
    const value = deps();
    const flow = createOwnerSheetFlow(value);
    await flow.start();
    expect(value.client.register).toHaveBeenCalledOnce();
    expect(value.copies.save).toHaveBeenCalledExactlyOnceWith(ids.owner, { locatorRecordId: ids.locator,
      sheetPayload: sheet.sheetPayload, printedLocator: sheet.printedLocator, printedSecret: sheet.printedSecret,
      expiresAt: sheet.expiresAt });
    expect(flow.getState()).toMatchObject({ status: "ready", reference: "200000", expiresAt: sheet.expiresAt });
    expect(JSON.stringify(flow.getState())).not.toMatch(/SKQ2|SK2-S|SK2-L/u);
  });

  it("saves the PDF and retries a cancelled or failed save with the same sheet, never a new one", async () => {
    const value = deps();
    value.exporter.save.mockResolvedValueOnce({ status: "cancelled" }).mockResolvedValueOnce({ status: "failed" });
    const flow = createOwnerSheetFlow(value);
    await flow.start();
    await flow.save();
    expect(flow.getState()).toMatchObject({ status: "ready", saveResult: { status: "cancelled" } });
    await flow.save();
    expect(flow.getState()).toMatchObject({ status: "ready", saveResult: { status: "failed" } });
    await flow.save("share");
    expect(flow.getState()).toMatchObject({ status: "ready", saveResult: saved });
    expect(value.exporter.save.mock.calls.map(([html, id, mode]) => [html, id, mode])).toEqual([
      ["<html>SK2-S-SECRET</html>", ids.locator, "folder"], ["<html>SK2-S-SECRET</html>", ids.locator, "folder"],
      ["<html>SK2-S-SECRET</html>", ids.locator, "share"]]);
    expect(value.createSheet).toHaveBeenCalledOnce();
    expect(value.client.register).toHaveBeenCalledOnce();
    expect(value.client.revoke).not.toHaveBeenCalled();
  });

  it("prints as an optional extra and keeps the sheet active when printing fails", async () => {
    const value = deps();
    value.exporter.print.mockResolvedValueOnce(false);
    const flow = createOwnerSheetFlow(value);
    await flow.start(); await flow.print();
    expect(flow.getState()).toMatchObject({ status: "ready", printFailed: true });
    expect(value.client.revoke).not.toHaveBeenCalled();
  });

  it("never revokes an active sheet when the owner leaves, backgrounds or locks", async () => {
    const value = deps();
    const flow = createOwnerSheetFlow(value);
    await flow.start(); await flow.save();
    await flow.handleAppState("background");
    expect(flow.getState().status).toBe("ready");
    await flow.abandon();
    expect(flow.getState().status).toBe("idle");
    expect(value.client.revoke).not.toHaveBeenCalled();
  });

  it("revokes a registered sheet whose encrypted copy could not be stored, and reports nothing saved", async () => {
    const value = deps({ copies: { save: vi.fn(async () => { throw new Error("disk full"); }) } });
    const flow = createOwnerSheetFlow(value);
    await flow.start();
    expect(flow.getState()).toMatchObject({ status: "failed", reference: null });
    expect(value.client.revoke).toHaveBeenCalledExactlyOnceWith(ids.locator, expect.any(String));
    await flow.save();
    expect(value.exporter.save).not.toHaveBeenCalled();
  });

  it("steps up with TOTP and retries registration with the same idempotency key", async () => {
    const value = deps();
    value.client.register.mockRejectedValueOnce(new OwnerOfflineCodeClientError("fresh_mfa_required"));
    const flow = createOwnerSheetFlow(value);
    await flow.start();
    expect(flow.getState().status).toBe("needs_fresh_mfa");
    await flow.handleAppState("background");
    expect(flow.getState().status).toBe("needs_fresh_mfa");
    await flow.submitMfaCode("000000");
    expect(flow.getState()).toMatchObject({ status: "needs_fresh_mfa", mfaRejected: true });
    await flow.submitMfaCode("123456");
    expect(flow.getState().status).toBe("ready");
    const keys = value.client.register.mock.calls.map((call) => (call as unknown[])[1]);
    expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]);
  });

  it("revokes a registration abandoned before the sheet became active, and ignores its late result", async () => {
    let release: () => void = () => undefined;
    const value = deps();
    value.client.register.mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve({ locatorRecordId: ids.locator, status: "active", replayed: false });
    }));
    const flow = createOwnerSheetFlow(value);
    const started = flow.start();
    await vi.waitFor(() => expect(flow.getState().status).toBe("registering"));
    await flow.handleAppState("background");
    release(); await started;
    expect(flow.getState().status).toBe("idle");
    expect(value.client.revoke).toHaveBeenCalledExactlyOnceWith(ids.locator, expect.any(String));
    expect(value.copies.save).not.toHaveBeenCalled();
  });

  it("fails without registering when generation fails, and revokes after a failed registration", async () => {
    const noSheet = deps({ createSheet: vi.fn(async () => { throw new Error("no"); }) });
    const first = createOwnerSheetFlow(noSheet);
    await first.start();
    expect(first.getState().status).toBe("failed");
    expect(noSheet.client.register).not.toHaveBeenCalled();
    const value = deps();
    value.client.register.mockRejectedValueOnce(new OwnerOfflineCodeClientError("failed"));
    value.client.revoke.mockRejectedValueOnce(new Error("offline"));
    const second = createOwnerSheetFlow(value);
    await second.start();
    expect(second.getState().status).toBe("failed");
    expect(value.client.revoke).toHaveBeenCalledOnce();
  });
});

describe("owner offline-code client", () => {
  const registration = sheet.registration;
  function client(response: { status: number; body?: unknown } | Error, token: string | null = "access-token") {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => {
      if (response instanceof Error) throw response;
      return new Response(JSON.stringify(response.body ?? {}), { status: response.status });
    });
    return { fetchImpl, api: createOwnerOfflineCodeClient({ apiBaseUrl: "https://api.test/", ownerOrigin:
      "https://owner.test", getAccessToken: async () => token, fetch: fetchImpl as unknown as typeof fetch }) };
  }

  it("posts only the registration with the owner token, origin and idempotency key", async () => {
    const { fetchImpl, api } = client({ status: 200, body: { locator_record_id: ids.locator, status: "active",
      replayed: false } });
    await expect(api.register(registration, ids.key)).resolves.toEqual({ locatorRecordId: ids.locator,
      status: "active", replayed: false });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.test/owner/offline-code/v2/locators");
    expect(init.headers).toEqual({ Authorization: "Bearer access-token", "Content-Type": "application/json",
      "Idempotency-Key": ids.key, Origin: "https://owner.test" });
    expect(JSON.parse(String(init.body))).toEqual(registration);
    expect(String(init.body)).not.toMatch(/SK2-S-|SKQ2/u);
  });

  it("revokes with an empty body and maps 403 to fresh MFA and everything else to failure", async () => {
    const revoked = client({ status: 200, body: { locator_record_id: ids.locator, status: "revoked", replayed: true } });
    await expect(revoked.api.revoke(ids.locator, ids.key)).resolves.toMatchObject({ status: "revoked", replayed: true });
    expect(revoked.fetchImpl.mock.calls[0]![0]).toBe(`https://api.test/owner/offline-code/v2/locators/${ids.locator}/revoke`);
    expect(revoked.fetchImpl.mock.calls[0]![1].body).toBe("{}");
    await expect(client({ status: 403 }).api.register(registration, ids.key))
      .rejects.toMatchObject({ kind: "fresh_mfa_required" });
    for (const response of [{ status: 404 }, { status: 409 }, { status: 503 }, new Error("network"),
      { status: 200, body: { locator_record_id: ids.key, status: "active", replayed: false } },
      { status: 200, body: { locator_record_id: ids.locator, status: "revoked", replayed: false } },
      { status: 200, body: { locator_record_id: ids.locator, status: "active", replayed: false, extra: 1 } }]) {
      await expect(client(response).api.register(registration, ids.key)).rejects.toMatchObject({ kind: "failed" });
    }
    const noToken = client({ status: 200 }, null);
    await expect(noToken.api.register(registration, ids.key)).rejects.toMatchObject({ kind: "failed" });
    expect(noToken.fetchImpl).not.toHaveBeenCalled();
    await expect(client({ status: 200 }).api.register(registration, "not-a-key")).rejects.toMatchObject({ kind: "failed" });
  });

  it("aborts on cancellation and on timeout", async () => {
    const hanging = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted"))); }));
    const api = createOwnerOfflineCodeClient({ apiBaseUrl: "https://api.test", ownerOrigin: "https://owner.test",
      getAccessToken: async () => "token", fetch: hanging as unknown as typeof fetch, timeoutMs: 20 });
    await expect(api.register(registration, ids.key)).rejects.toMatchObject({ kind: "failed" });
    const cancel = new AbortController(); const pending = api.register(registration, ids.key, cancel.signal);
    cancel.abort(); await expect(pending).rejects.toMatchObject({ kind: "failed" });
  });
});

