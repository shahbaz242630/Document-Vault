import { describe, expect, it, vi } from "vitest";

import { createOwnerOfflineCodeClient, OwnerOfflineCodeClientError, type OwnerOfflineCodeSheetSummary }
  from "./owner-offline-code-client";
import type { OwnerOfflineCodeSheet } from "./owner-offline-code-sheet-factory";
import { renderOwnerSheetHtml } from "./owner-sheet-html";
import { createOwnerSheetListFlow, type OwnerSheetListState } from "./owner-sheet-list-flow";
import { ownerSheetListView } from "./owner-sheet-list-view-model";
import { ownerSheetReference } from "./owner-sheet-reference";
import { createOwnerSheetListHandle, OWNER_SHEET_FLOW_LAUNCH_APPROVED } from "./owner-sheet-runtime";

vi.mock("expo-print", () => ({ printAsync: vi.fn() }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "60000000-0000-4000-8000-000000000006" }));
vi.mock("@/features/vault", () => ({ useVaultSession: vi.fn() }));
vi.mock("@/shared/api/supabase-client", () => ({ createSupabaseClient: vi.fn() }));

const ids = { first: "3f9a1c2b-0000-4000-8000-000000000001", second: "7d0e4b11-0000-4000-8000-000000000002",
  key: "90000000-0000-4000-8000-000000000009" };
const active = (id: string, issuedAt = "2026-09-25T09:00:00.000Z"): OwnerOfflineCodeSheetSummary =>
  ({ locatorRecordId: id, status: "active", issuedAt, expiresAt: "2027-09-25T09:00:00.000Z", revokedAt: null });
const wire = (sheet: OwnerOfflineCodeSheetSummary) => ({ locator_record_id: sheet.locatorRecordId,
  status: sheet.status, issued_at: sheet.issuedAt, expires_at: sheet.expiresAt, revoked_at: sheet.revokedAt });

function fakeClient(sheets: OwnerOfflineCodeSheetSummary[]) {
  const client = {
    list: vi.fn(async () => sheets),
    revoke: vi.fn(async (id: string, _key: string, _signal?: AbortSignal) => {
      sheets = sheets.map((sheet) => sheet.locatorRecordId === id
        ? { ...sheet, status: "revoked" as const, revokedAt: "2026-09-26T09:00:00.000Z" } : sheet);
      return { locatorRecordId: id, status: "revoked" as const, replayed: false };
    }),
  };
  return client;
}

describe("owner sheet reference", () => {
  it("is the first six characters of the record ID in capitals, and is printed on the sheet", () => {
    expect(ownerSheetReference(ids.first)).toBe("3F9A1C");
    const html = renderOwnerSheetHtml({ sheetPayload: "SKQ2.eyJ4Ijp0cnVlfQ", printedLocator: "L", printedSecret: "S",
      expiresAt: "2027-09-25T09:00:00.000Z", registration: { locatorRecordId: ids.first } } as OwnerOfflineCodeSheet);
    expect(html).toContain("<dt>Reference</dt><dd>3F9A1C</dd>");
  });
});

describe("owner offline-code client list", () => {
  function client(response: Response | Error) {
    const fetch = vi.fn(async () => { if (response instanceof Error) throw response; return response; });
    return { fetch, client: createOwnerOfflineCodeClient({ apiBaseUrl: "https://api.test/", fetch: fetch as never,
      ownerOrigin: "https://owner.test", getAccessToken: async () => "jwt" }) };
  }
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

  it("sends a bodiless GET with the owner's token and origin and returns the parsed sheets", async () => {
    const { fetch, client: owner } = client(json({ sheets: [wire(active(ids.first))] }));
    await expect(owner.list()).resolves.toEqual([active(ids.first)]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/owner/offline-code/v2/locators");
    expect(init).toMatchObject({ method: "GET", headers: { Authorization: "Bearer jwt", Origin: "https://owner.test" } });
    expect(init.body).toBeUndefined();
  });

  it("rejects extra fields, bad values, oversized lists and failures generically", async () => {
    for (const body of [{ sheets: [{ ...wire(active(ids.first)), locator_commitment: "x" }] },
      { sheets: [{ ...wire(active(ids.first)), status: "live" }] },
      { sheets: [{ ...wire(active(ids.first)), issued_at: "yesterday" }] },
      { sheets: [], extra: true }, { sheets: Array.from({ length: 51 }, () => wire(active(ids.first))) }]) {
      await expect(client(json(body)).client.list()).rejects.toMatchObject({ kind: "failed" });
    }
    await expect(client(json({}, 500)).client.list()).rejects.toMatchObject({ kind: "failed" });
    await expect(client(new Error("offline")).client.list()).rejects.toBeInstanceOf(OwnerOfflineCodeClientError);
  });
});

describe("owner sheet list flow", () => {
  it("loads the owner's sheets, then revokes one after confirmation and refreshes", async () => {
    const api = fakeClient([active(ids.first), active(ids.second)]);
    const flow = createOwnerSheetListFlow({ client: api, verifyFreshMfa: vi.fn(), randomUUID: () => ids.key });
    await flow.load();
    expect(flow.getState()).toMatchObject({ status: "ready", sheets: [active(ids.first), active(ids.second)] });
    flow.requestRevoke(ids.second);
    expect(flow.getState()).toMatchObject({ status: "confirming", selected: ids.second });
    await flow.confirmRevoke();
    expect(api.revoke).toHaveBeenCalledExactlyOnceWith(ids.second, ids.key, expect.any(AbortSignal));
    expect(flow.getState()).toMatchObject({ status: "ready", selected: null, revoked: true });
    expect(flow.getState().sheets.map((sheet) => sheet.status)).toEqual(["active", "revoked"]);
  });

  it("asks for a fresh code and retries the revoke with the same idempotency key", async () => {
    const api = fakeClient([active(ids.first)]);
    api.revoke.mockRejectedValueOnce(new OwnerOfflineCodeClientError("fresh_mfa_required"));
    const verifyFreshMfa = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    let keys = 0;
    const flow = createOwnerSheetListFlow({ client: api, verifyFreshMfa, randomUUID: () => `${ids.key.slice(0, -1)}${keys++}` });
    await flow.load(); flow.requestRevoke(ids.first); await flow.confirmRevoke();
    expect(flow.getState()).toMatchObject({ status: "needs_fresh_mfa", selected: ids.first });
    await flow.submitMfaCode("000000");
    expect(flow.getState()).toMatchObject({ status: "needs_fresh_mfa", mfaRejected: true });
    await flow.submitMfaCode("123456");
    expect(api.revoke.mock.calls.map(([, key]) => key)).toEqual([`${ids.key.slice(0, -1)}0`, `${ids.key.slice(0, -1)}0`]);
    expect(flow.getState()).toMatchObject({ status: "ready", revoked: true });
  });

  it("revokes only active sheets, and keeps the list when a revoke fails", async () => {
    const expired = { ...active(ids.second), status: "expired" as const };
    const api = fakeClient([active(ids.first), expired]);
    api.revoke.mockRejectedValueOnce(new OwnerOfflineCodeClientError("failed"));
    const flow = createOwnerSheetListFlow({ client: api, verifyFreshMfa: vi.fn(), randomUUID: () => ids.key });
    await flow.load();
    flow.requestRevoke(ids.second); expect(flow.getState().status).toBe("ready");
    flow.requestRevoke("not-a-sheet"); expect(flow.getState().status).toBe("ready");
    flow.requestRevoke(ids.first); await flow.confirmRevoke();
    expect(flow.getState()).toMatchObject({ status: "ready", revokeFailed: true, selected: null });
    expect(flow.getState().sheets).toHaveLength(2);
  });

  it("cancels a pending revoke and ignores results that arrive after the screen closes", async () => {
    let release: (value: OwnerOfflineCodeSheetSummary[]) => void = () => undefined;
    const api = fakeClient([active(ids.first)]);
    const flow = createOwnerSheetListFlow({ client: api, verifyFreshMfa: vi.fn(), randomUUID: () => ids.key });
    await flow.load(); flow.requestRevoke(ids.first); flow.cancelRevoke();
    expect(flow.getState()).toMatchObject({ status: "ready", selected: null });
    expect(api.revoke).not.toHaveBeenCalled();
    api.list.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const pending = flow.load(); flow.close(); release([active(ids.second)]); await pending;
    expect(flow.getState()).toMatchObject({ status: "loading", sheets: [] });
  });

  it("shows a failure without detail when the list cannot load", async () => {
    const api = fakeClient([]); api.list.mockRejectedValueOnce(new OwnerOfflineCodeClientError("failed"));
    const flow = createOwnerSheetListFlow({ client: api, verifyFreshMfa: vi.fn(), randomUUID: () => ids.key });
    await flow.load();
    expect(ownerSheetListView(flow.getState())).toMatchObject({ showRetry: true, rows: [],
      notice: { title: "Sheets not loaded" } });
  });
});

describe("owner sheet list view", () => {
  const state = (changes: Partial<OwnerSheetListState>): OwnerSheetListState => ({ status: "ready", sheets: [],
    selected: null, mfaRejected: false, revokeFailed: false, revoked: false, ...changes });

  it("is unavailable without a handle and hidden behind the literal-false launch approval", () => {
    expect(OWNER_SHEET_FLOW_LAUNCH_APPROVED).toBe(false);
    expect(createOwnerSheetListHandle({ auth: null, env: {} })).toBeNull();
    expect(ownerSheetListView(null)).toMatchObject({ body: "Emergency sheets aren't available yet.", rows: [] });
  });

  it("shows each sheet's reference, dates and status, and offers revoke on active sheets only", () => {
    const view = ownerSheetListView(state({ sheets: [active(ids.first), { ...active(ids.second), status: "revoked",
      revokedAt: "2026-09-26T09:00:00.000Z" }] }));
    expect(view.rows).toEqual([
      { id: ids.first, reference: "3F9A1C", printed: "Printed 25 September 2026",
        validity: "Valid until 25 September 2027", statusLabel: "Active", canRevoke: true },
      { id: ids.second, reference: "7D0E4B", printed: "Printed 25 September 2026",
        validity: "Revoked 26 September 2026", statusLabel: "Revoked", canRevoke: false }]);
  });

  it("names the sheet being revoked and explains the consequence", () => {
    const view = ownerSheetListView(state({ status: "confirming", selected: ids.first, sheets: [active(ids.first)] }));
    expect(view.confirmReference).toBe("3F9A1C");
    expect(view.body).toContain("will no longer be able to start a claim");
    expect(ownerSheetListView(state({ status: "needs_fresh_mfa", selected: ids.first, mfaRejected: true })))
      .toMatchObject({ showMfaField: true, notice: { title: "Code not accepted" } });
  });
});
