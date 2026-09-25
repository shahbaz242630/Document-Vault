import { describe, expect, it, vi } from "vitest";

import { createOwnerOfflineCodeClient, OwnerOfflineCodeClientError } from "./owner-offline-code-client";
import type { OwnerOfflineCodeSheet } from "./owner-offline-code-sheet-factory";
import { createOwnerSheetFlow, type OwnerSheetFlowDeps } from "./owner-sheet-flow";

const ids = { owner: "10000000-0000-4000-8000-000000000001", locator: "20000000-0000-4000-8000-000000000002",
  key: "30000000-0000-4000-8000-000000000003" };
const sheet: OwnerOfflineCodeSheet = Object.freeze({ sheetPayload: "SKQ2.synthetic-payload",
  printedLocator: "SK2-L-LOCATOR", printedSecret: "SK2-S-SECRET", expiresAt: "2027-09-25T09:00:00.000Z",
  registration: Object.freeze({ locatorRecordId: ids.locator, grantId: "40000000-0000-4000-8000-000000000004",
    publicLocator: "SK2-L-LOCATOR", locatorCommitment: "c", proofPublicKey: "p", recordBindingDigest: "d",
    kdfSalt: "s", wrapNonce: "n", wrapCiphertext: "x", wrapAssociatedDataDigest: "a",
    issuedAt: "2026-09-25T09:00:00.000Z", expiresAt: "2027-09-25T09:00:00.000Z" }) });

function deps(changes: Partial<Omit<OwnerSheetFlowDeps, "client">> = {}) {
  let counter = 0;
  const value = {
    createSheet: vi.fn(async () => sheet),
    getOwnerId: vi.fn(async () => ids.owner),
    client: { register: vi.fn(async () => ({ locatorRecordId: ids.locator, status: "active" as const, replayed: false })),
      revoke: vi.fn(async () => ({ locatorRecordId: ids.locator, status: "revoked" as const, replayed: false })) },
    verifyFreshMfa: vi.fn(async (code: string) => code === "123456"),
    renderSheetHtml: vi.fn((value: OwnerOfflineCodeSheet) => `<html>${value.printedSecret}</html>`),
    print: vi.fn(async () => undefined),
    randomUUID: vi.fn(() => `50000000-0000-4000-8000-${String((counter += 1)).padStart(12, "0")}`),
    ...changes,
  };
  return value;
}

describe("owner emergency sheet flow", () => {
  it("generates, registers once, prints and wipes on confirmation without exposing the sheet", async () => {
    const d = deps(); const flow = createOwnerSheetFlow(d); const states: string[] = [];
    flow.subscribe((value) => states.push(value.status));
    await flow.start();
    expect(flow.getState()).toEqual({ status: "ready_to_print", expiresAt: sheet.expiresAt, mfaRejected: false,
      printFailed: false });
    expect(d.createSheet).toHaveBeenCalledWith(expect.objectContaining({ ownerId: ids.owner }));
    expect(d.client.register).toHaveBeenCalledWith(sheet.registration, expect.any(String), expect.any(AbortSignal));
    await flow.print(); await flow.print();
    expect(d.print).toHaveBeenCalledTimes(2);
    expect(d.print).toHaveBeenCalledWith("<html>SK2-S-SECRET</html>");
    flow.confirmPrinted();
    expect(states).toEqual(["generating", "generating", "registering", "ready_to_print", "printing", "printed",
      "printing", "printed", "done"]);
    expect(JSON.stringify(flow.getState())).not.toMatch(/SK2-|SKQ2/u);
    await flow.print(); await flow.abandon();
    expect(d.print).toHaveBeenCalledTimes(2); expect(d.client.revoke).not.toHaveBeenCalled();
  });

  it("steps up with TOTP and retries registration with the same idempotency key", async () => {
    const d = deps();
    d.client.register.mockRejectedValueOnce(new OwnerOfflineCodeClientError("fresh_mfa_required"));
    const flow = createOwnerSheetFlow(d);
    await flow.start();
    expect(flow.getState().status).toBe("needs_fresh_mfa");
    await flow.submitMfaCode("000000");
    expect(flow.getState()).toMatchObject({ status: "needs_fresh_mfa", mfaRejected: true });
    expect(d.client.register).toHaveBeenCalledTimes(1);
    await flow.submitMfaCode("123456");
    expect(flow.getState().status).toBe("ready_to_print");
    const keys = d.client.register.mock.calls.map((call) => (call as unknown[])[1]);
    expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]);
  });

  it("revokes an attempted registration when abandoned before confirmation, in every live state", async () => {
    for (const reach of ["ready_to_print", "printed", "needs_fresh_mfa"] as const) {
      const d = deps();
      if (reach === "needs_fresh_mfa") {
        d.client.register.mockRejectedValueOnce(new OwnerOfflineCodeClientError("fresh_mfa_required"));
      }
      const flow = createOwnerSheetFlow(d);
      await flow.start(); if (reach === "printed") await flow.print();
      expect(flow.getState().status).toBe(reach);
      await flow.abandon();
      expect(d.client.revoke).toHaveBeenCalledWith(ids.locator, expect.any(String));
      expect(flow.getState()).toMatchObject({ status: "idle", expiresAt: null });
      await flow.print(); expect(d.print).toHaveBeenCalledTimes(reach === "printed" ? 1 : 0);
    }
  });

  it("revokes a registration abandoned in flight and ignores its late result", async () => {
    let finish: () => void = () => undefined;
    const d = deps();
    d.client.register.mockImplementationOnce(() => new Promise((resolve) => {
      finish = () => resolve({ locatorRecordId: ids.locator, status: "active", replayed: false }); }));
    const flow = createOwnerSheetFlow(d);
    const started = flow.start();
    await vi.waitFor(() => expect(flow.getState().status).toBe("registering"));
    await flow.abandon(); finish(); await started;
    expect(d.client.revoke).toHaveBeenCalledTimes(1);
    expect(flow.getState().status).toBe("idle");
  });

  it("fails without registering when generation fails, and revokes after a failed registration", async () => {
    const noOwner = deps({ getOwnerId: vi.fn(async () => null) }); const first = createOwnerSheetFlow(noOwner);
    await first.start();
    expect(first.getState().status).toBe("failed"); expect(noOwner.createSheet).not.toHaveBeenCalled();
    const badSheet = deps({ createSheet: vi.fn(async () => { throw new Error("self-check failed"); }) });
    const second = createOwnerSheetFlow(badSheet); await second.start();
    expect(second.getState().status).toBe("failed");
    expect(badSheet.client.register).not.toHaveBeenCalled(); expect(badSheet.client.revoke).not.toHaveBeenCalled();
    const serverDown = deps(); serverDown.client.register.mockRejectedValueOnce(new OwnerOfflineCodeClientError("failed"));
    const third = createOwnerSheetFlow(serverDown); await third.start();
    expect(third.getState().status).toBe("failed");
    expect(serverDown.client.revoke).toHaveBeenCalledWith(ids.locator, expect.any(String));
  });

  it("keeps the sheet ready after a print error and swallows revoke failures", async () => {
    const d = deps({ print: vi.fn(async () => { throw new Error("printer"); }) });
    d.client.revoke.mockRejectedValueOnce(new Error("offline"));
    const flow = createOwnerSheetFlow(d); await flow.start(); await flow.print();
    expect(flow.getState()).toMatchObject({ status: "ready_to_print", printFailed: true });
    await expect(flow.abandon()).resolves.toBeUndefined();
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

describe("owner emergency sheet flow and app state", () => {
  it("abandons on background except while printing or waiting for the MFA code", async () => {
    let finishPrint: () => void = () => undefined;
    const d = deps({ print: vi.fn(() => new Promise<void>((resolve) => { finishPrint = resolve; })) });
    const flow = createOwnerSheetFlow(d); await flow.start();
    const printing = flow.print();
    await flow.handleAppState("background"); await flow.handleAppState("inactive");
    expect(flow.getState().status).toBe("printing"); expect(d.client.revoke).not.toHaveBeenCalled();
    finishPrint(); await printing;
    await flow.handleAppState("active"); expect(flow.getState().status).toBe("printed");
    await flow.handleAppState("background");
    expect(flow.getState().status).toBe("idle"); expect(d.client.revoke).toHaveBeenCalledTimes(1);

    const mfa = deps(); mfa.client.register.mockRejectedValueOnce(new OwnerOfflineCodeClientError("fresh_mfa_required"));
    const stepUp = createOwnerSheetFlow(mfa); await stepUp.start();
    await stepUp.handleAppState("background");
    expect(stepUp.getState().status).toBe("needs_fresh_mfa");
    await stepUp.abandon();
    expect(stepUp.getState().status).toBe("idle");
  });

  it("keeps the expiry date after confirmation for the success message", async () => {
    const flow = createOwnerSheetFlow(deps()); await flow.start(); await flow.print(); flow.confirmPrinted();
    expect(flow.getState()).toEqual({ status: "done", expiresAt: sheet.expiresAt, mfaRejected: false, printFailed: false });
  });
});
