import type { OwnerOfflineCodeSheetRegistration } from "./owner-offline-code-sheet-factory";

/*
 * Slice 6H: the owner's client for the 6G register and revoke routes. It sends only the registration inputs; the
 * printed secret, the sheet payload and the vault key never reach it.
 */
export type OwnerOfflineCodeClientDeps = Readonly<{
  apiBaseUrl: string;
  ownerOrigin: string;
  getAccessToken: () => Promise<string | null>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}>;

export type OwnerOfflineCodeResult = Readonly<{
  locatorRecordId: string;
  status: "active" | "revoked";
  replayed: boolean;
}>;

/** Slice 6J: one of the owner's sheets as the list route returns it: dates and status only. */
export type OwnerOfflineCodeSheetSummary = Readonly<{
  locatorRecordId: string;
  status: "active" | "revoked" | "expired";
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}>;

export class OwnerOfflineCodeClientError extends Error {
  constructor(readonly kind: "fresh_mfa_required" | "failed") {
    super("The emergency sheet request could not be completed.");
    this.name = "OwnerOfflineCodeClientError";
  }
}

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const sheetKeys = "expires_at,issued_at,locator_record_id,revoked_at,status";
const isoTimestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function parseSheet(value: unknown): OwnerOfflineCodeSheetSummary {
  const sheet = value as Record<string, unknown>;
  if (!sheet || typeof sheet !== "object" || Object.keys(sheet).sort().join(",") !== sheetKeys
    || typeof sheet.locator_record_id !== "string" || !uuidV4.test(sheet.locator_record_id)
    || !["active", "revoked", "expired"].includes(sheet.status as string)
    || !isoTimestamp(sheet.issued_at) || !isoTimestamp(sheet.expires_at)
    || !(sheet.revoked_at === null || isoTimestamp(sheet.revoked_at))) throw new OwnerOfflineCodeClientError("failed");
  return Object.freeze({ locatorRecordId: sheet.locator_record_id,
    status: sheet.status as OwnerOfflineCodeSheetSummary["status"], issuedAt: sheet.issued_at,
    expiresAt: sheet.expires_at, revokedAt: sheet.revoked_at as string | null });
}

export function createOwnerOfflineCodeClient(deps: OwnerOfflineCodeClientDeps) {
  const base = deps.apiBaseUrl.replace(/\/$/u, "");
  const post = async (path: string, body: unknown, idempotencyKey: string, expected: "active" | "revoked",
    locatorRecordId: string, signal?: AbortSignal): Promise<OwnerOfflineCodeResult> => {
    if (!uuidV4.test(idempotencyKey) || !uuidV4.test(locatorRecordId)) throw new OwnerOfflineCodeClientError("failed");
    const token = await deps.getAccessToken().catch(() => null);
    if (!token) throw new OwnerOfflineCodeClientError("failed");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort);
    const timer = setTimeout(abort, deps.timeoutMs ?? 15_000);
    try {
      if (signal?.aborted) throw new Error("aborted");
      const response = await (deps.fetch ?? fetch)(`${base}${path}`, { method: "POST", body: JSON.stringify(body),
        signal: controller.signal, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey, Origin: deps.ownerOrigin } });
      if (response.status === 403) throw new OwnerOfflineCodeClientError("fresh_mfa_required");
      if (response.status !== 200) throw new OwnerOfflineCodeClientError("failed");
      const value = await response.json() as Record<string, unknown>;
      if (!value || typeof value !== "object" || Object.keys(value).sort().join(",") !== "locator_record_id,replayed,status"
        || value.locator_record_id !== locatorRecordId || value.status !== expected
        || typeof value.replayed !== "boolean") throw new OwnerOfflineCodeClientError("failed");
      return Object.freeze({ locatorRecordId, status: expected, replayed: value.replayed });
    } catch (error) {
      if (error instanceof OwnerOfflineCodeClientError) throw error;
      throw new OwnerOfflineCodeClientError("failed");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };
  const list = async (signal?: AbortSignal): Promise<readonly OwnerOfflineCodeSheetSummary[]> => {
    const token = await deps.getAccessToken().catch(() => null);
    if (!token) throw new OwnerOfflineCodeClientError("failed");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort);
    const timer = setTimeout(abort, deps.timeoutMs ?? 15_000);
    try {
      if (signal?.aborted) throw new Error("aborted");
      const response = await (deps.fetch ?? fetch)(`${base}/owner/offline-code/v2/locators`, { method: "GET",
        signal: controller.signal, headers: { Authorization: `Bearer ${token}`, Origin: deps.ownerOrigin } });
      if (response.status === 403) throw new OwnerOfflineCodeClientError("fresh_mfa_required");
      if (response.status !== 200) throw new OwnerOfflineCodeClientError("failed");
      const value = await response.json() as Record<string, unknown>;
      if (!value || typeof value !== "object" || Object.keys(value).join(",") !== "sheets"
        || !Array.isArray(value.sheets) || value.sheets.length > 50) throw new OwnerOfflineCodeClientError("failed");
      return Object.freeze(value.sheets.map(parseSheet));
    } catch (error) {
      if (error instanceof OwnerOfflineCodeClientError) throw error;
      throw new OwnerOfflineCodeClientError("failed");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };
  return {
    list,
    register: (registration: OwnerOfflineCodeSheetRegistration, idempotencyKey: string, signal?: AbortSignal) =>
      post("/owner/offline-code/v2/locators", registration, idempotencyKey, "active",
        registration.locatorRecordId, signal),
    revoke: (locatorRecordId: string, idempotencyKey: string, signal?: AbortSignal) =>
      post(`/owner/offline-code/v2/locators/${locatorRecordId}/revoke`, {}, idempotencyKey, "revoked",
        locatorRecordId, signal),
  };
}

export type OwnerOfflineCodeClient = ReturnType<typeof createOwnerOfflineCodeClient>;
