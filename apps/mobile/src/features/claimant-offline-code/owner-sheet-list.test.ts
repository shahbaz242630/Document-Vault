import { describe, expect, it, vi } from "vitest";

import { createOwnerOfflineCodeClient, OwnerOfflineCodeClientError, type OwnerOfflineCodeSheetSummary }
  from "./owner-offline-code-client";
import { renderOwnerSheetHtml } from "./owner-sheet-html";
import { createOwnerSheetListFlow, type OwnerSheetListState } from "./owner-sheet-list-flow";
import { ownerSheetListView } from "./owner-sheet-list-view-model";
import { ownerSheetReference } from "./owner-sheet-reference";
import { createOwnerSheetListHandle, OWNER_SHEET_FLOW_LAUNCH_APPROVED } from "./owner-sheet-runtime";

vi.mock("expo-print", () => ({ printAsync: vi.fn(), printToFileAsync: vi.fn() }));
vi.mock("expo-file-system", () => ({ Directory: class {}, File: class {}, Paths: {} }));
vi.mock("expo-sharing", () => ({ shareAsync: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
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
      expiresAt: "2027-09-25T09:00:00.000Z", locatorRecordId: ids.first });
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
  it("loads the owner's sheets and changes nothing itself: revoking lives on each sheet's screen", async () => {
    const api = fakeClient([active(ids.first), active(ids.second)]);
    const flow = createOwnerSheetListFlow({ client: api, verifyFreshMfa: vi.fn() });
    await flow.load();
    expect(flow.getState()).toMatchObject({ status: "ready", sheets: [active(ids.first), active(ids.second)] });
    expect(flow).not.toHaveProperty("requestRevoke");
    expect(api.revoke).not.toHaveBeenCalled();
  });

  it("ignores results that arrive after the screen closes", async () => {
    let release: (value: OwnerOfflineCodeSheetSummary[]) => void = () => undefined;
    const api = fakeClient([active(ids.first)]);
    const flow = createOwnerSheetListFlow({ client: api, verifyFreshMfa: vi.fn() });
    api.list.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const pending = flow.load(); flow.close(); release([active(ids.second)]); await pending;
    expect(flow.getState()).toMatchObject({ status: "loading", sheets: [] });
  });

  it("shows a failure without detail when the list cannot load", async () => {
    const api = fakeClient([]); api.list.mockRejectedValueOnce(new OwnerOfflineCodeClientError("failed"));
    const flow = createOwnerSheetListFlow({ client: api, verifyFreshMfa: vi.fn() });
    await flow.load();
    expect(ownerSheetListView(flow.getState())).toMatchObject({ showRetry: true, rows: [],
      notice: { title: "Sheets not loaded" } });
  });
});

describe("owner sheet list view", () => {
  const state = (changes: Partial<OwnerSheetListState>): OwnerSheetListState => ({ status: "ready", sheets: [],
    mfaRejected: false, loadFailure: null, ...changes });

  it("is unavailable without a handle and hidden behind the literal-false launch approval", () => {
    expect(OWNER_SHEET_FLOW_LAUNCH_APPROVED).toBe(false);
    expect(createOwnerSheetListHandle({ auth: null, env: {} })).toBeNull();
    expect(ownerSheetListView(null)).toMatchObject({ body: "Emergency sheets aren't available yet.", rows: [] });
  });

  it("shows each sheet's reference, dates and status, with actions on active sheets only", () => {
    const view = ownerSheetListView(state({ sheets: [active(ids.first), { ...active(ids.second), status: "revoked",
      revokedAt: "2026-09-26T09:00:00.000Z" }] }));
    expect(view.rows).toEqual([
      { id: ids.first, reference: "3F9A1C", printed: "Created 25 September 2026",
        validity: "Valid until 25 September 2027", statusLabel: "Active", badge: { label: "Active", tone: "active" },
        actions: ["view", "save", "revoke"] },
      { id: ids.second, reference: "7D0E4B", printed: "Created 25 September 2026",
        validity: "Revoked 26 September 2026", statusLabel: "Revoked", badge: { label: "Revoked", tone: "revoked" },
        actions: [] }]);
  });
});
