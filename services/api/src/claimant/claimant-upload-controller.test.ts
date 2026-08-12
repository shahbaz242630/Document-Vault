import { createHash } from "node:crypto";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { getClaimantRuntimeConfig } from "./runtime-config.js";
import { CLAIMANT_UPLOAD_CONTROLLER_APPROVED, createClaimantUploadConcurrencyGuardV1,
  createClaimantUploadControllerV1, createClaimantUploadPreflightControllerV1,
  type ClaimantUploadControllerActionV1 } from "./claimant-upload-controller.js";
import { CLAIMANT_SYNTHETIC_UPLOAD_ADAPTERS_APPROVED, createClaimantSyntheticUploadAdaptersV1 }
  from "./claimant-upload-synthetic-adapters.js";

const ids = { case: "40000000-0000-4000-8000-000000000001",
  object: "40000000-0000-4000-8000-000000000002",
  processor: "40000000-0000-4000-8000-000000000003",
  request: "40000000-0000-4000-8000-000000000004",
  session: "40000000-0000-4000-8000-000000000005",
  user: "40000000-0000-4000-8000-000000000006" };
const apiOrigin = "https://api.sanduqkin.test";
const claimantOrigin = "https://claimant.sanduqkin.test";
const objectPath = `v1/${ids.case}/${ids.object}`;
const token = Buffer.alloc(32, 5).toString("base64url");
const now = new Date("2026-08-12T12:00:00.000Z");

describe("claimant upload controller", () => {
  it("is statically concealed before configuration or adapters are touched", async () => {
    expect(CLAIMANT_UPLOAD_CONTROLLER_APPROVED).toBe(false);
    expect(CLAIMANT_SYNTHETIC_UPLOAD_ADAPTERS_APPROVED).toBe(false);
    const getConfig = vi.fn();
    const response = await routeApp("issue", { getConfig }).request(url("capability"), issueRequest());
    expect(response.status).toBe(404); expect(getConfig).not.toHaveBeenCalled();
  });

  it("conceals exact API-origin and portal-origin mismatches", async () => {
    const deps = approved();
    const wrongPortal = await routeApp("issue", deps).request(url("capability"),
      issueRequest({ Origin: "https://evil.test" }));
    const wrongApi = await routeApp("issue", deps).request(
      `https://api-alt.sanduqkin.test/cases/${ids.case}/capabilities`, issueRequest());
    expect(wrongPortal.status).toBe(404); expect(wrongApi.status).toBe(404);
    expect(deps.createPortalClient).not.toHaveBeenCalled();
  });

  it("issues a case-bound capability only after fresh AAL2 and active portal assertion", async () => {
    const deps = approved();
    const response = await routeApp("issue", deps).request(url("capability"), issueRequest());
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.result).toMatchObject({ bucket: "claimant-evidence-quarantine-v1",
      capability: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), object_path: expect.stringContaining(ids.case) });
    expect(deps.portal.assert).toHaveBeenCalledWith(ids.user, ids.session);
    expect(deps.transactions.issue).toHaveBeenCalledWith(expect.objectContaining({
      caseId: ids.case, claimantUserId: ids.user, portalSessionId: ids.session }));
  });

  it("rejects stale AAL2 before portal assertion or transaction work", async () => {
    const deps = approved();
    deps.portal.getSession.mockResolvedValueOnce(session({ amr: [{ method: "totp", timestamp: 1 }] }));
    const response = await routeApp("issue", deps).request(url("capability"), issueRequest());
    expect(response.status).toBe(403); expect(deps.portal.assert).not.toHaveBeenCalled();
    expect(deps.transactions.issue).not.toHaveBeenCalled();
  });

  it("preflights authority and streams exact declared bytes with server-derived processor authority", async () => {
    const deps = approved();
    const response = await routeApp("upload", deps).request(url("object"), uploadRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: { object_id: ids.object, status: "clean", version: 2 } });
    expect(deps.transactions.reconcile).toHaveBeenCalledWith({
      capabilityDigest: createHash("sha256").update(token).digest("hex"), objectId: ids.object });
    expect(deps.transactions.quarantine).toHaveBeenCalledWith(expect.objectContaining({
      processorUserId: ids.processor, sizeBytes: 4 }));
  });

  it("does not touch storage when content length disagrees with server authority", async () => {
    const deps = approved();
    const response = await routeApp("upload", deps).request(url("object"),
      uploadRequest({ "Content-Length": "5" }));
    expect(response.status).toBe(400); expect(deps.storage.put).not.toHaveBeenCalled();
  });

  it("returns generic conflicts and never exposes provider details", async () => {
    const deps = approved();
    deps.transactions.reconcile.mockRejectedValueOnce(new Error("secret provider topology"));
    const response = await routeApp("upload", deps).request(url("object"), uploadRequest());
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('{"error":"Request could not be completed"}');
  });

  it("reconciles through the same capability, assurance, and portal boundary", async () => {
    const deps = approved();
    const response = await routeApp("reconcile", deps).request(url("reconcile"), {
      method: "POST", headers: { Authorization: "Bearer jwt", "Content-Type": "application/json",
        "Idempotency-Key": ids.request, Origin: claimantOrigin,
        "X-Claimant-Upload-Capability": token }, body: "{}" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: { status: "upload_pending" } });
    expect(deps.portal.assert).toHaveBeenCalledWith(ids.user, ids.session);
  });

  it("returns a bounded retry response before creating transaction authority", async () => {
    const deps = approved();
    const response = await routeApp("upload", { ...deps,
      concurrency: { acquire: vi.fn(() => null) } }).request(url("object"), uploadRequest());
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("1");
    expect(await response.text()).toBe('{"error":"Request could not be completed"}');
    expect(deps.createTransactions).not.toHaveBeenCalled();
  });

  it("uses a bounded claimant-case concurrency guard and exact preflight headers", async () => {
    const guard = createClaimantUploadConcurrencyGuardV1(); const release = guard.acquire("claimant|case");
    expect(release).toBeTypeOf("function"); expect(guard.acquire("claimant|case")).toBeNull();
    release!(); expect(guard.acquire("claimant|case")).toBeTypeOf("function");
    const app = routeApp("upload", approved());
    const response = await app.request(url("object"), { method: "OPTIONS", headers: {
      Origin: claimantOrigin, "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "Authorization, Content-Type, Idempotency-Key, X-Claimant-Upload-Capability" } });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(claimantOrigin);
  });
});

describe("synthetic claimant upload adapters", () => {
  it("stay disabled by default and accept only exact predeclared fixture bytes", async () => {
    expect(() => createClaimantSyntheticUploadAdaptersV1({})).toThrow(/disabled/u);
    const fixture = Buffer.from("test");
    const adapters = createClaimantSyntheticUploadAdaptersV1({ [objectPath]: {
      body: fixture, mediaType: "application/pdf", pageCount: 1, scanResult: "clean" } }, true);
    await adapters.storage.put({ body: chunks(fixture), bucket: "claimant-evidence-quarantine-v1",
      contentType: "application/pdf", objectPath, signal: new AbortController().signal });
    expect(await adapters.storage.exists({ bucket: "claimant-evidence-quarantine-v1", objectPath })).toBe(true);
    expect(await adapters.inspector.inspect({ bucket: "claimant-evidence-quarantine-v1", objectPath }))
      .toMatchObject({ detectedMediaType: "application/pdf", pageCount: 1 });
    await expect(adapters.storage.put({ body: chunks(Buffer.from("evil")),
      bucket: "claimant-evidence-quarantine-v1", contentType: "application/pdf", objectPath,
      signal: new AbortController().signal })).rejects.toThrow(/mismatch/u);
  });
});

function routeApp(action: ClaimantUploadControllerActionV1,
  deps: Parameters<typeof createClaimantUploadControllerV1>[1]) {
  const app = new Hono(); const path = action === "issue" ? "/cases/:caseId/capabilities"
    : action === "upload" ? "/cases/:caseId/objects/:objectId" : "/cases/:caseId/objects/:objectId/reconcile";
  if (action === "upload") app.put(path, createClaimantUploadControllerV1(action, deps));
  else app.post(path, createClaimantUploadControllerV1(action, deps));
  app.options(path, createClaimantUploadPreflightControllerV1(action, deps)); return app;
}
function url(kind: "capability" | "object" | "reconcile") { return kind === "capability"
  ? `${apiOrigin}/cases/${ids.case}/capabilities` : `${apiOrigin}/cases/${ids.case}/objects/${ids.object}`
    + (kind === "reconcile" ? "/reconcile" : ""); }
function issueRequest(headers: Record<string, string> = {}) { return { method: "POST", headers: {
  Authorization: "Bearer jwt", "Content-Type": "application/json", "Idempotency-Key": ids.request,
  Origin: claimantOrigin, ...headers }, body: JSON.stringify({ expected_case_version: 2,
    expected_intake_version: 3, item_key: "claimant_photo_identity",
    placeholder_ref: "synthetic_evidence_claimant_photo_identity", preparation_version: 4 }) }; }
function uploadRequest(headers: Record<string, string> = {}) { return { method: "PUT", headers: {
  Authorization: "Bearer jwt", "Content-Length": "4", "Content-Type": "application/pdf",
  "Idempotency-Key": ids.request, Origin: claimantOrigin,
  "X-Claimant-Upload-Capability": token, ...headers }, body: Buffer.from("test") }; }
function approved() {
  const portal = { activate: vi.fn(), assert: vi.fn().mockResolvedValue({ context: "claimant_portal",
    sessionVersion: 1 }), getSession: vi.fn().mockResolvedValue(session()), revoke: vi.fn() };
  const transactions = { abandon: vi.fn(), confirmDeleted: vi.fn(), issue: vi.fn(async (value) => ({
    caseId: value.caseId, expiresAt: value.expiresAt, objectId: value.objectId,
    objectPath: value.objectPath, replayed: false })), planDeletion: vi.fn(),
    quarantine: vi.fn().mockResolvedValue({ caseId: ids.case, objectId: ids.object, replayed: false,
      status: "quarantined", version: 1 }), reconcile: vi.fn().mockResolvedValue(authority()),
    scan: vi.fn().mockResolvedValue({ caseId: ids.case, objectId: ids.object, replayed: false,
      status: "clean", version: 2 }) };
  const storage = { exists: vi.fn().mockResolvedValue(false), remove: vi.fn(),
    put: vi.fn(async ({ body }) => { for await (const _chunk of body) void _chunk; }) };
  return { approved: true as const, createPortalClient: vi.fn(() => portal),
    createTransactions: vi.fn(() => transactions), getConfig: vi.fn(() => config()),
    inspector: { inspect: vi.fn().mockResolvedValue({ archiveEntryCount: 1,
      detectedMediaType: "application/pdf", expandedSizeBytes: 4, pageCount: 1, signatureValid: true }) },
    now: () => now, portal, runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test",
      CLAIMANT_RUNTIME_ENABLED: "true", CLAIMANT_AUTHENTICATION_ENABLED: "true",
      CLAIMANT_REGISTERED_RECIPIENT_ENABLED: "true", CLAIMANT_INTAKE_ENABLED: "true",
      CLAIMANT_EVIDENCE_UPLOAD_ENABLED: "true" }), scanner: { scan: vi.fn().mockResolvedValue("clean") },
    storage, transactions };
}
function config() { return { apiOrigin, capabilityDerivationKey: Buffer.alloc(32, 6), claimantOrigin,
  controllerDerivationKey: Buffer.alloc(32, 7), freshAssuranceSeconds: 600,
  processorUserId: ids.processor, serviceRoleKey: "service-role", supabaseUrl: "https://db.test" }; }
function session(changes = {}) { const epoch = Math.floor(now.getTime() / 1000); return { aal: "aal2" as const,
  amr: [{ method: "totp", timestamp: epoch }], expiresAt: epoch + 3600, issuedAt: epoch - 60,
  sessionId: ids.session, userId: ids.user, ...changes }; }
function authority() { return { authority: "upload_pending" as const, capabilityStatus: "issued" as const,
  caseId: ids.case, expectedMediaType: "application/pdf" as const, expectedSizeBytes: 4,
  objectId: ids.object, objectPath, objectStatus: null, objectVersion: null }; }
async function* chunks(value: Uint8Array) { yield value; }
