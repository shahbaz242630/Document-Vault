import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { formatOfflineCodePublicLocatorV2, normalizeOfflineCodePublicLocatorV2 } from "@vault/shared-types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { app as mountedApp } from "../index.js";
import { offlineCodeV2BoundaryDigest } from "./offline-code-v2-locator-index.js";
import { CLAIMANT_OFFLINE_CODE_V2_OWNER_ROUTES_APPROVED, createOfflineCodeV2OwnerListRoute,
  createOfflineCodeV2OwnerPreflightRoute, createOfflineCodeV2OwnerRoute } from "./offline-code-v2-owner-routes.js";
import { createOfflineCodeV2OwnerSheetReader, OfflineCodeV2PersistenceTransactionError }
  from "./offline-code-v2-persistence-transaction-client.js";
import { RegisteredRecipientMutationError } from "./registered-recipient-client.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

const vector = JSON.parse(readFileSync(resolve(process.cwd(),
  "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8"));
const ids = { owner: vector.record_binding.owner_id as string,
  locator: vector.record_binding.locator_record_id as string,
  grant: vector.record_binding.grant_id as string,
  session: "71000000-0000-4000-8000-000000000002", request: "71000000-0000-4000-8000-000000000003",
  other: "71000000-0000-4000-8000-000000000004" };
const apiOrigin = "https://api.sanduqkin.test";
const ownerOrigin = "https://owner.sanduqkin.test";
const claimantOrigin = "https://claimant.sanduqkin.test";
const locatorIndexKey = vector.synthetic_locator_index_key as string;
const now = new Date("2026-09-25T09:00:00.000Z");
const paths = { register: "/owner/offline-code/v2/locators",
  revoke: "/owner/offline-code/v2/locators/:locatorRecordId/revoke" } as const;

function validBody(changes: Record<string, unknown> = {}) {
  return { locatorRecordId: ids.locator, grantId: ids.grant, publicLocator: vector.public_locator.locator,
    locatorCommitment: vector.record_binding.locator_commitment,
    proofPublicKey: vector.record_binding.proof_public_key, recordBindingDigest: vector.record_binding_digest,
    kdfSalt: vector.kdf_profile.salt, wrapNonce: vector.wrap.envelope.nonce,
    wrapCiphertext: vector.wrap.envelope.ciphertext,
    wrapAssociatedDataDigest: createHash("sha256")
      .update(Buffer.from(vector.wrap.associated_data_canonical, "base64url")).digest("base64url"),
    issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
    ...changes };
}

describe("owner offline-code V2 registration and revocation routes", () => {
  it("stays literal-false and concealed on the mounted app before configuration is read", async () => {
    expect(CLAIMANT_OFFLINE_CODE_V2_OWNER_ROUTES_APPROVED).toBe(false);
    const getConfig = vi.fn();
    expect((await routeApp("register", { getConfig }).request(url("register"), request())).status).toBe(404);
    expect(getConfig).not.toHaveBeenCalled();
    const capabilityOff = approved();
    const disabled = await routeApp("register", { ...capabilityOff,
      runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test" }) }).request(url("register"), request());
    expect(disabled.status).toBe(404); expect(capabilityOff.getConfig).not.toHaveBeenCalled();
    for (const action of ["register", "revoke"] as const) {
      expect((await mountedApp.request(url(action), request(action))).status).toBe(404);
      expect((await mountedApp.request(url(action), { method: "OPTIONS", headers: preflightHeaders() }))
        .status).toBe(404);
    }
  });

  it("opens only on the activated claimant-preview deployment (W1)", async () => {
    const preview = { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "claimant-preview",
      CLAIMANT_PREVIEW_ACTIVATION: "synthetic-only" };
    try {
      for (const [name, value] of Object.entries(preview)) vi.stubEnv(name, value);
      const { approved: _approved, ...deps } = approved();
      expect((await routeApp("register", deps).request(url("register"), request())).status).toBe(200);
      for (const [name, value] of [["VERCEL_GIT_COMMIT_REF", "main"], ["VERCEL_ENV", "production"],
        ["CLAIMANT_PREVIEW_ACTIVATION", ""]] as const) {
        vi.stubEnv(name, value);
        const concealed = approved(); const { approved: _off, ...closed } = concealed;
        expect((await routeApp("register", closed).request(url("register"), request())).status).toBe(404);
        expect(concealed.getConfig).not.toHaveBeenCalled();
        vi.stubEnv(name, preview[name]);
      }
    } finally { vi.unstubAllEnvs(); }
  });

  it("registers under the session owner with the same locator index the challenge route derives", async () => {
    const deps = approved();
    const response = await routeApp("register", deps).request(url("register"), request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ locator_record_id: ids.locator, status: "active", replayed: false });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ownerOrigin);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(deps.owner.getSession).toHaveBeenCalledWith("jwt");
    expect(deps.owner.assertActiveSession).toHaveBeenCalledWith(ids.owner, ids.session);
    const { publicLocator: _publicLocator, ...stored } = validBody();
    expect(deps.persistence.register).toHaveBeenCalledWith({ ...stored, ownerUserId: ids.owner,
      idempotencyKey: ids.request, locatorIndexDigest: offlineCodeV2BoundaryDigest(
        Buffer.from(locatorIndexKey, "base64url"), "locator",
        normalizeOfflineCodePublicLocatorV2(vector.public_locator.locator)) });
    expect(deps.persistence.revoke).not.toHaveBeenCalled();
  });

  it("refuses a sheet whose record binding names another owner", async () => {
    const deps = approved();
    deps.owner.getSession.mockResolvedValueOnce(session({ userId: ids.other }));
    const response = await routeApp("register", deps).request(url("register"), request());
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('{"error":"Invalid request"}');
    expect(deps.persistence.register).not.toHaveBeenCalled();
  });

  it("rejects tampered, malformed, extra and key-bearing registration bodies before persistence", async () => {
    const tampered = (value: string) => `${value.slice(0, 10)}${value[10] === "A" ? "B" : "A"}${value.slice(11)}`;
    const otherLocator = formatOfflineCodePublicLocatorV2(new Uint8Array(16));
    for (const changes of [
      { locatorCommitment: tampered(vector.record_binding.locator_commitment) },
      { recordBindingDigest: tampered(vector.record_binding_digest) },
      { proofPublicKey: tampered(vector.record_binding.proof_public_key) },
      { grantId: ids.other }, { locatorRecordId: ids.other },
      { publicLocator: vector.public_locator.locator.replace(/.$/u, "0") }, { publicLocator: otherLocator },
      { ownerUserId: ids.owner }, { clientSecret: vector.synthetic_client_secret.secret },
      { sheetPayload: "SKQ2.x" }, { mek: vector.wrap.mek },
      { issuedAt: new Date(now.getTime() - 120_000).toISOString() },
      { issuedAt: "2026-09-25T09:00:00Z" },
      { expiresAt: now.toISOString() },
      { expiresAt: new Date(now.getTime() + 366 * 86_400_000).toISOString() },
      { wrapCiphertext: "short" }, { locatorRecordId: "not-a-uuid" },
    ]) {
      const deps = approved();
      const response = await routeApp("register", deps).request(url("register"), request("register", changes));
      expect(response.status, JSON.stringify(Object.keys(changes))).toBe(400);
      expect(deps.persistence.register).not.toHaveBeenCalled();
    }
    const deps = approved();
    const missing = validBody() as Record<string, unknown>; delete missing.wrapNonce;
    expect((await routeApp("register", deps).request(url("register"), { ...request(),
      body: JSON.stringify(missing) })).status).toBe(400);
    expect((await routeApp("register", deps).request(url("register"), { ...request(),
      body: "{" })).status).toBe(400);
  });

  it("requires an active fresh AAL2 owner session before reading the body", async () => {
    for (const [change, status] of [
      [{ aal: "aal1" }, 403], [{ amr: [{ method: "totp", timestamp: epoch() - 3_600 }] }, 403],
      [{ amr: [{ method: "totp", timestamp: epoch() }, { method: "recovery", timestamp: epoch() }] }, 403],
      [{ expiresAt: epoch() - 1 }, 403],
    ] as const) {
      const deps = approved(); deps.owner.getSession.mockResolvedValueOnce(session(change));
      const response = await routeApp("register", deps).request(url("register"), request());
      expect(response.status).toBe(status); expect(deps.owner.assertActiveSession).not.toHaveBeenCalled();
      expect(deps.createPersistence).not.toHaveBeenCalled();
    }
    const invalidToken = approved(); invalidToken.owner.getSession.mockRejectedValueOnce(new Error("bad"));
    expect((await routeApp("register", invalidToken).request(url("register"), request())).status).toBe(401);
    const revokedSession = approved();
    revokedSession.owner.assertActiveSession.mockRejectedValueOnce(new RegisteredRecipientMutationError({ code: "28000" }));
    expect((await routeApp("register", revokedSession).request(url("register"), request())).status).toBe(401);
    expect(revokedSession.createPersistence).not.toHaveBeenCalled();
    const noToken = approved();
    expect((await routeApp("register", noToken).request(url("register"), request("register", {},
      { Authorization: "" }))).status).toBe(401);
    expect(noToken.createOwnerSessionClient).not.toHaveBeenCalled();
  });

  it("conceals wrong, claimant and API-origin mismatches before any client is created", async () => {
    for (const action of ["register", "revoke"] as const) {
      for (const [target, headers] of [
        [url(action), { Origin: claimantOrigin }], [url(action), { Origin: "https://evil.test" }],
        [url(action).replace(apiOrigin, "https://alternate.test"), {}],
      ] as const) {
        const deps = approved();
        const response = await routeApp(action, deps).request(target, request(action, {}, headers));
        expect(response.status).toBe(404); expect(deps.createOwnerSessionClient).not.toHaveBeenCalled();
        expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      }
    }
  });

  it("enforces media type, idempotency key, size and preflight boundaries", async () => {
    const deps = approved();
    expect((await routeApp("register", deps).request(url("register"), request("register", {},
      { "Content-Type": "text/plain" }))).status).toBe(415);
    expect((await routeApp("register", deps).request(url("register"), request("register", {},
      { "Idempotency-Key": "not-a-key" }))).status).toBe(400);
    expect((await routeApp("register", deps).request(url("register"), request("register", {},
      { "Content-Length": "20000" }))).status).toBe(413);
    expect((await routeApp("register", deps).request(url("register"), { ...request(),
      body: JSON.stringify({ ...validBody(), padding: "x".repeat(17_000) }) })).status).toBe(413);
    expect(deps.persistence.register).not.toHaveBeenCalled();
    const preflight = await routeApp("register", deps).request(url("register"),
      { method: "OPTIONS", headers: preflightHeaders() });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(ownerOrigin);
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toBe("POST");
    for (const headers of [preflightHeaders({ Origin: claimantOrigin }),
      preflightHeaders({ "Access-Control-Request-Method": "PUT" }),
      preflightHeaders({ "Access-Control-Request-Headers": "Authorization, Content-Type, Idempotency-Key, X-Extra" })]) {
      expect((await routeApp("register", deps).request(url("register"), { method: "OPTIONS", headers }))
        .status).toBe(404);
    }
  });

  it("maps idempotency changes, duplicates and contention to a generic 409 and outages to 503", async () => {
    for (const [code, status] of [["22023", 409], ["23505", 409], ["40001", 409], ["42501", 404],
      ["XX000", 503]] as const) {
      const deps = approved();
      deps.persistence.register.mockRejectedValueOnce(new OfflineCodeV2PersistenceTransactionError(code));
      const response = await routeApp("register", deps).request(url("register"), request());
      expect(response.status).toBe(status);
      expect(JSON.stringify(await response.json())).not.toMatch(/Offline-code|locator|owner/u);
    }
    const replay = approved(); replay.persistence.register.mockResolvedValueOnce(registered(true));
    expect(await (await routeApp("register", replay).request(url("register"), request())).json())
      .toEqual({ locator_record_id: ids.locator, status: "active", replayed: true });
    const missing = approved({ getConfig: vi.fn(() => null) });
    expect((await routeApp("register", missing).request(url("register"), request())).status).toBe(503);
  });

  it("revokes only through the session owner with a fixed reason and an empty body", async () => {
    const deps = approved();
    const response = await routeApp("revoke", deps).request(url("revoke"), request("revoke"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ locator_record_id: ids.locator, status: "revoked", replayed: false });
    expect(deps.persistence.revoke).toHaveBeenCalledWith({ locatorRecordId: ids.locator, ownerUserId: ids.owner,
      expectedLocatorVersion: 2, reason: "owner_revoked", idempotencyKey: ids.request });
    expect(deps.persistence.register).not.toHaveBeenCalled();
    for (const body of [{ reason: "claimant_dispute" }, { ownerUserId: ids.other }]) {
      const rejected = approved();
      expect((await routeApp("revoke", rejected).request(url("revoke"), { ...request("revoke"),
        body: JSON.stringify(body) })).status).toBe(400);
      expect(rejected.persistence.revoke).not.toHaveBeenCalled();
    }
    const badId = approved();
    expect((await routeApp("revoke", badId).request(url("revoke").replace(ids.locator, "nope"),
      request("revoke"))).status).toBe(400);
    const foreign = approved();
    foreign.persistence.revoke.mockRejectedValueOnce(new OfflineCodeV2PersistenceTransactionError("42501"));
    const denied = await routeApp("revoke", foreign).request(url("revoke"), request("revoke"));
    expect(denied.status).toBe(404); expect(await denied.text()).toBe('{"error":"Not found"}');
    const stale = approved(); stale.owner.getSession.mockResolvedValueOnce(session({ aal: "aal1" }));
    expect((await routeApp("revoke", stale).request(url("revoke"), request("revoke"))).status).toBe(403);
    expect(stale.persistence.revoke).not.toHaveBeenCalled();
  });
});

function routeApp(action: "register" | "revoke", deps: Parameters<typeof createOfflineCodeV2OwnerRoute>[1]) {
  const result = new Hono();
  result.post(paths[action], createOfflineCodeV2OwnerRoute(action, deps));
  result.options(paths[action], createOfflineCodeV2OwnerPreflightRoute(deps));
  return result;
}
function url(action: "register" | "revoke") {
  return action === "register" ? `${apiOrigin}${paths.register}`
    : `${apiOrigin}/owner/offline-code/v2/locators/${ids.locator}/revoke`;
}
function request(action: "register" | "revoke" = "register", changes: Record<string, unknown> = {},
  headerChanges: Record<string, string> = {}) {
  return { method: "POST", headers: { Authorization: "Bearer jwt", "Content-Type": "application/json",
    "Idempotency-Key": ids.request, Origin: ownerOrigin, ...headerChanges },
  body: JSON.stringify(action === "register" ? validBody(changes) : changes) };
}
function preflightHeaders(changes: Record<string, string> = {}) {
  return { Origin: ownerOrigin, "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "Authorization, Content-Type, Idempotency-Key", ...changes };
}
function registered(replayed = false) {
  return { locatorRecordId: ids.locator, locatorVersion: 2 as const, status: "active" as const,
    authority: "route_possession_only" as const, syntheticOnly: true as const, claimCreated: false as const,
    releaseAuthorized: false as const, replayed };
}
function approved(overrides: Record<string, unknown> = {}) {
  const owner = { acceptInvitation: vi.fn(), activateSession: vi.fn(),
    assertActiveSession: vi.fn().mockResolvedValue(undefined), getSession: vi.fn().mockResolvedValue(session()),
    issueInvitation: vi.fn(), manageLifecycle: vi.fn(), revokeInvitation: vi.fn(), revokeSession: vi.fn() };
  const persistence = { issueChallenge: vi.fn(), recordAttempt: vi.fn(),
    register: vi.fn().mockResolvedValue(registered()),
    revoke: vi.fn().mockResolvedValue({ locatorRecordId: ids.locator, locatorVersion: 2, status: "revoked",
      futureChallengesAllowed: false, claimCreated: false, releaseAuthorized: false, replayed: false }) };
  return { approved: true as const, createOwnerSessionClient: vi.fn(() => owner),
    createPersistence: vi.fn(() => persistence),
    getConfig: vi.fn(() => ({ apiOrigin, ownerOrigin, freshAssuranceSeconds: 600, locatorIndexKey,
      serviceRoleKey: "service-role", supabaseUrl: "https://db.test" })),
    now: () => now, owner, persistence,
    runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test", CLAIMANT_RUNTIME_ENABLED: "true",
      CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_OFFLINE_CODE_V2_ENABLED: "true" }), ...overrides };
}
function epoch() { return Math.floor(now.getTime() / 1000); }
function session(changes = {}) {
  return { aal: "aal2" as const, amr: [{ method: "totp", timestamp: epoch() }], expiresAt: epoch() + 3_600,
    issuedAt: epoch() - 60, sessionId: ids.session, userId: ids.owner, ...changes };
}

describe("owner offline-code V2 sheet list route (Slice 6J)", () => {
  const listPath = "/owner/offline-code/v2/locators";
  const sheets = [{ locatorRecordId: ids.locator, status: "active" as const, issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 86_400_000).toISOString(), revokedAt: null }];
  function listDeps(overrides: Record<string, unknown> = {}) {
    const reader = { listOwnerSheets: vi.fn().mockResolvedValue(sheets) };
    return { ...approved(), reader, createSheetReader: vi.fn(() => reader), ...overrides };
  }
  function listApp(deps: Parameters<typeof createOfflineCodeV2OwnerListRoute>[0]) {
    const app = new Hono();
    app.get(listPath, createOfflineCodeV2OwnerListRoute(deps));
    app.options(listPath, createOfflineCodeV2OwnerPreflightRoute(deps));
    app.options(paths.revoke, createOfflineCodeV2OwnerPreflightRoute(deps));
    return app;
  }
  const get = (headers: Record<string, string> = {}) => ({ method: "GET",
    headers: { Authorization: "Bearer jwt", Origin: ownerOrigin, ...headers } });

  it("stays concealed on the mounted app and before configuration is read", async () => {
    expect((await mountedApp.request(`${apiOrigin}${listPath}`, get())).status).toBe(404);
    const getConfig = vi.fn();
    expect((await listApp({ getConfig }).request(`${apiOrigin}${listPath}`, get())).status).toBe(404);
    expect(getConfig).not.toHaveBeenCalled();
  });

  it("lists only the session owner's sheets, with dates and status and nothing else", async () => {
    const deps = listDeps();
    const response = await listApp(deps).request(`${apiOrigin}${listPath}`, get());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ sheets: [{ locator_record_id: ids.locator, status: "active",
      issued_at: sheets[0]!.issuedAt, expires_at: sheets[0]!.expiresAt, revoked_at: null }] });
    expect(deps.reader.listOwnerSheets).toHaveBeenCalledExactlyOnceWith(ids.owner);
    expect(deps.owner.assertActiveSession).toHaveBeenCalledWith(ids.owner, ids.session);
    expect(deps.persistence.register).not.toHaveBeenCalled();
  });

  it("needs AAL2 without recovery but not a fresh MFA step-up", async () => {
    const stale = listDeps();
    stale.owner.getSession.mockResolvedValueOnce(session({ amr: [{ method: "totp", timestamp: epoch() - 7_200 }] }));
    expect((await listApp(stale).request(`${apiOrigin}${listPath}`, get())).status).toBe(200);
    for (const changes of [{ aal: "aal1" }, { expiresAt: epoch() - 1 },
      { amr: [{ method: "recovery", timestamp: epoch() }] }]) {
      const deps = listDeps();
      deps.owner.getSession.mockResolvedValueOnce(session(changes));
      expect((await listApp(deps).request(`${apiOrigin}${listPath}`, get())).status).toBe(403);
      expect(deps.reader.listOwnerSheets).not.toHaveBeenCalled();
    }
  });

  it("refuses a missing token, the wrong origin, a request body and a failed database read", async () => {
    const deps = listDeps();
    expect((await listApp(deps).request(`${apiOrigin}${listPath}`, { method: "GET",
      headers: { Origin: ownerOrigin } })).status).toBe(401);
    expect((await listApp(deps).request(`${apiOrigin}${listPath}`, get({ Origin: claimantOrigin }))).status)
      .toBe(404);
    expect((await listApp(deps).request(`${apiOrigin}${listPath}`, get({ "Content-Length": "2" }))).status)
      .toBe(400);
    const failing = listDeps();
    failing.reader.listOwnerSheets.mockRejectedValueOnce(new OfflineCodeV2PersistenceTransactionError("XX000"));
    const failed = await listApp(failing).request(`${apiOrigin}${listPath}`, get());
    expect(failed.status).toBe(503);
    expect(await failed.text()).toBe('{"error":"Request could not be completed"}');
  });

  it("answers a GET preflight on the list path only, with the authorization header only", async () => {
    const deps = listDeps();
    const preflight = (path: string, method: string, headers: string) => listApp(deps).request(`${apiOrigin}${path}`,
      { method: "OPTIONS", headers: { Origin: ownerOrigin, "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": headers } });
    const ok = await preflight(listPath, "GET", "authorization");
    expect(ok.status).toBe(204);
    expect(ok.headers.get("Access-Control-Allow-Methods")).toBe("GET");
    expect(ok.headers.get("Access-Control-Allow-Headers")).toBe("Authorization");
    expect((await preflight(listPath, "GET", "authorization, content-type")).status).toBe(404);
    expect((await preflight(paths.revoke.replace(":locatorRecordId", ids.locator), "GET", "authorization"))
      .status).toBe(404);
    expect((await preflight(listPath, "POST", "authorization, content-type, idempotency-key")).status).toBe(204);
  });
});

describe("owner sheet reader (Slice 6J)", () => {
  const row = { locator_record_id: ids.locator, status: "active", issued_at: "2026-09-25T09:00:00.123456+00:00",
    expires_at: "2026-10-25T09:00:00+00:00", revoked_at: null };
  const reader = (data: unknown, error: { code?: string } | null = null) =>
    createOfflineCodeV2OwnerSheetReader(async () => ({ data, error }));
  const envelope = (sheets: unknown[]) => ({ sheets, synthetic_only: true, claim_created: false,
    release_authorized: false });

  it("normalises PostgreSQL timestamps and keeps only the allowed fields", async () => {
    await expect(reader(envelope([row])).listOwnerSheets(ids.owner)).resolves.toEqual([{
      locatorRecordId: ids.locator, status: "active", issuedAt: "2026-09-25T09:00:00.123Z",
      expiresAt: "2026-10-25T09:00:00.000Z", revokedAt: null }]);
  });

  it("rejects extra fields, inconsistent revocation facts and database errors", async () => {
    await expect(reader(envelope([{ ...row, locator_commitment: "x" }])).listOwnerSheets(ids.owner)).rejects.toThrow();
    await expect(reader(envelope([{ ...row, status: "revoked" }])).listOwnerSheets(ids.owner)).rejects.toThrow();
    await expect(reader(envelope([{ ...row, revoked_at: "2026-09-26T09:00:00+00:00" }])).listOwnerSheets(ids.owner))
      .rejects.toThrow();
    await expect(reader({ ...envelope([]), release_authorized: true }).listOwnerSheets(ids.owner)).rejects.toThrow();
    await expect(reader(null, { code: "42501" }).listOwnerSheets(ids.owner))
      .rejects.toBeInstanceOf(OfflineCodeV2PersistenceTransactionError);
  });
});
