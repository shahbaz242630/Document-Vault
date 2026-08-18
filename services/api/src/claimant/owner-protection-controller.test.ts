import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { app as mountedApp } from "../index.js";
import { CLAIMANT_OWNER_PROTECTION_CONTROLLER_APPROVED,
  createOwnerProtectionConcurrencyGuardV1, createOwnerProtectionControllerV1,
  createOwnerProtectionPreflightControllerV1 } from "./owner-protection-controller.js";
import { OwnerProtectionTransactionError } from "./owner-protection-transaction-client.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

const ids = { case: "70000000-0000-4000-8000-000000000001",
  cycle: "70000000-0000-4000-8000-000000000002",
  user: "70000000-0000-4000-8000-000000000003",
  session: "70000000-0000-4000-8000-000000000004",
  request: "70000000-0000-4000-8000-000000000005" };
const apiOrigin = "https://api.sanduqkin.test";
const ownerOrigin = "https://owner.sanduqkin.test";
const claimantOrigin = "https://claimant.sanduqkin.test";
const now = new Date("2026-08-18T12:00:00.000Z");

describe("owner protection controller", () => {
  it("keeps both mounted routes concealed before configuration or clients are touched", async () => {
    expect(CLAIMANT_OWNER_PROTECTION_CONTROLLER_APPROVED).toBe(false);
    const getConfig = vi.fn();
    const concealed = await routeApp("ownerCancel", { getConfig }).request(url("ownerCancel"),
      request("ownerCancel"));
    expect(concealed.status).toBe(404); expect(getConfig).not.toHaveBeenCalled();
    expect((await mountedApp.request(url("ownerCancel"), request("ownerCancel"))).status).toBe(404);
    expect((await mountedApp.request(url("claimantDispute"), request("claimantDispute"))).status)
      .toBe(404);
  });

  it("conceals API, client-origin, and cross-role origin mismatches before authentication", async () => {
    for (const action of ["ownerCancel", "claimantDispute"] as const) {
      const deps = approved();
      const wrongOrigin = action === "ownerCancel" ? claimantOrigin : ownerOrigin;
      expect((await routeApp(action, deps).request(url(action),
        request(action, {}, { Origin: wrongOrigin }))).status).toBe(404);
      expect((await routeApp(action, deps).request(url(action).replace(apiOrigin,
        "https://alternate.test"), request(action))).status).toBe(404);
      expect(deps.createOwnerSessionClient).not.toHaveBeenCalled();
      expect(deps.createPortalClient).not.toHaveBeenCalled();
    }
  });

  it("derives owner cancellation authority from only the active owner session", async () => {
    const deps = approved();
    const response = await routeApp("ownerCancel", deps).request(url("ownerCancel"),
      request("ownerCancel", { actor_user_id: ids.user, reason: "claimant_dispute" }));
    expect(response.status).toBe(400);
    expect(deps.transactions.stop).not.toHaveBeenCalled();

    const success = await routeApp("ownerCancel", deps).request(url("ownerCancel"),
      request("ownerCancel"));
    expect(success.status).toBe(200);
    expect(deps.owner.getSession).toHaveBeenCalledWith("jwt");
    expect(deps.owner.assertActiveSession).toHaveBeenCalledWith(ids.user, ids.session);
    expect(deps.createPortalClient).not.toHaveBeenCalled();
    expect(deps.transactions.stop).toHaveBeenCalledWith({ actorUserId: ids.user,
      caseId: ids.case, cycleId: ids.cycle, expectedCaseVersion: 2,
      idempotencyKey: ids.request, reason: "owner_cancelled" });
  });

  it("derives claimant dispute authority from only the active portal session", async () => {
    const deps = approved({ status: "disputed", state: "on_hold" });
    const response = await routeApp("claimantDispute", deps).request(url("claimantDispute"),
      request("claimantDispute"));
    expect(response.status).toBe(200);
    expect(deps.portal.getSession).toHaveBeenCalledWith("jwt");
    expect(deps.portal.assert).toHaveBeenCalledWith(ids.user, ids.session);
    expect(deps.createOwnerSessionClient).not.toHaveBeenCalled();
    expect(deps.transactions.stop).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: ids.user, reason: "claimant_dispute" }));
  });

  it("rejects stale and recovery assurance before session or transaction authority", async () => {
    for (const action of ["ownerCancel", "claimantDispute"] as const) {
      for (const amr of [[{ method: "totp", timestamp: 1 }],
        [{ method: "totp", timestamp: epoch() }, { method: "recovery", timestamp: epoch() }]]) {
        const deps = approved();
        const authority = action === "ownerCancel" ? deps.owner : deps.portal;
        authority.getSession.mockResolvedValueOnce(session({ amr }));
        const response = await routeApp(action, deps).request(url(action), request(action));
        expect(response.status).toBe(403);
        expect(action === "ownerCancel" ? deps.owner.assertActiveSession : deps.portal.assert)
          .not.toHaveBeenCalled();
        expect(deps.transactions.stop).not.toHaveBeenCalled();
      }
    }
  });

  it("enforces exact media, UUIDv4, JSON, size, and preflight boundaries", async () => {
    const deps = approved(); const action = "ownerCancel" as const;
    expect((await routeApp(action, deps).request(url(action),
      request(action, {}, { "Content-Type": "text/plain" }))).status).toBe(415);
    expect((await routeApp(action, deps).request(url(action),
      request(action, {}, { "Content-Length": "5000" }))).status).toBe(413);
    expect((await routeApp(action, deps).request(url(action).replace(ids.case, "not-a-case"),
      request(action))).status).toBe(400);
    expect((await routeApp(action, deps).request(url(action),
      request(action, { extra: true }))).status).toBe(400);
    const headers = { Origin: ownerOrigin, "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Authorization, Content-Type, Idempotency-Key" };
    const preflight = await routeApp(action, deps).request(url(action), { method: "OPTIONS", headers });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(ownerOrigin);
    const hostile = await routeApp(action, deps).request(url(action), { method: "OPTIONS", headers: {
      ...headers, "Access-Control-Request-Headers": `${headers["Access-Control-Request-Headers"]}, X-Extra` } });
    expect(hostile.status).toBe(404);
  });

  it("maps cross-role/cross-case denials to 404 and version contention generically", async () => {
    const deps = approved();
    deps.transactions.stop.mockRejectedValueOnce(new OwnerProtectionTransactionError("42501"));
    const denied = await routeApp("ownerCancel", deps).request(url("ownerCancel"),
      request("ownerCancel"));
    expect(denied.status).toBe(404); expect(await denied.text()).toBe('{"error":"Not found"}');
    deps.transactions.stop.mockRejectedValueOnce(new OwnerProtectionTransactionError("40001"));
    const conflict = await routeApp("ownerCancel", deps).request(url("ownerCancel"),
      request("ownerCancel"));
    expect(conflict.status).toBe(409);
    expect(await conflict.text()).toBe('{"error":"Request could not be completed"}');
  });

  it("returns bounded contention before creating transaction authority and releases its guard", async () => {
    const deps = approved();
    const response = await routeApp("ownerCancel", { ...deps,
      concurrency: { acquire: vi.fn(() => null) } }).request(url("ownerCancel"),
      request("ownerCancel"));
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("1");
    expect(deps.createTransactions).not.toHaveBeenCalled();
    const guard = createOwnerProtectionConcurrencyGuardV1(); const release = guard.acquire("actor|case");
    expect(release).toBeTypeOf("function"); expect(guard.acquire("actor|case")).toBeNull();
    release!(); expect(guard.acquire("actor|case")).toBeTypeOf("function");
    expect(() => createOwnerProtectionConcurrencyGuardV1(3)).toThrow(/bound/u);
  });

  it("returns only a safe immutable non-release result", async () => {
    const deps = approved(); const response = await routeApp("ownerCancel", deps)
      .request(url("ownerCancel"), request("ownerCancel"));
    expect(await response.json()).toEqual({ result: { case_id: ids.case, case_version: 3,
      cooldown_active: false, cooldown_expires_at: null, cycle_id: ids.cycle, cycle_number: 1,
      release_authorized: false, replayed: false, review_started: false,
      state: "cancelled_by_owner", status: "cancelled" } });
  });
});

function routeApp(action: "ownerCancel" | "claimantDispute",
  deps: Parameters<typeof createOwnerProtectionControllerV1>[1]) {
  const result = new Hono(); const path = action === "ownerCancel"
    ? "/owner/cases/:caseId/protection/cancel" : "/claimant/cases/:caseId/protection/dispute";
  result.post(path, createOwnerProtectionControllerV1(action, deps));
  result.options(path, createOwnerProtectionPreflightControllerV1(action, deps)); return result;
}
function url(action: "ownerCancel" | "claimantDispute") { return action === "ownerCancel"
  ? `${apiOrigin}/owner/cases/${ids.case}/protection/cancel`
  : `${apiOrigin}/claimant/cases/${ids.case}/protection/dispute`; }
function request(action: "ownerCancel" | "claimantDispute", changes: Record<string, unknown> = {},
  headerChanges: Record<string, string> = {}) { return { method: "POST", headers: {
    Authorization: "Bearer jwt", "Content-Type": "application/json", "Idempotency-Key": ids.request,
    Origin: action === "ownerCancel" ? ownerOrigin : claimantOrigin, ...headerChanges },
  body: JSON.stringify({ cycle_id: ids.cycle, expected_case_version: 2, ...changes }) }; }
function approved(resultChanges = {}) {
  const owner = { acceptInvitation: vi.fn(), activateSession: vi.fn(),
    assertActiveSession: vi.fn().mockResolvedValue(undefined), getSession: vi.fn().mockResolvedValue(session()),
    issueInvitation: vi.fn(), manageLifecycle: vi.fn(), revokeInvitation: vi.fn(), revokeSession: vi.fn() };
  const portal = { activate: vi.fn(), assert: vi.fn().mockResolvedValue({ context: "claimant_portal",
    sessionVersion: 1 }), getSession: vi.fn().mockResolvedValue(session()), revoke: vi.fn() };
  const transactions = { begin: vi.fn(), recordDelivery: vi.fn(), stop: vi.fn().mockResolvedValue({
    caseId: ids.case, caseVersion: 3, cooldownActive: false, cooldownExpiresAt: null,
    cycleId: ids.cycle, cycleNumber: 1, releaseAuthorized: false, replayed: false,
    reviewStarted: false, state: "cancelled_by_owner", status: "cancelled", ...resultChanges }) };
  return { approved: true as const, createOwnerSessionClient: vi.fn(() => owner),
    createPortalClient: vi.fn(() => portal), createTransactions: vi.fn(() => transactions),
    getConfig: vi.fn(() => ({ apiOrigin, claimantOrigin, freshAssuranceSeconds: 600, ownerOrigin,
      serviceRoleKey: "service-role", supabaseUrl: "https://db.test" })), now: () => now, owner, portal,
    runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test", CLAIMANT_RUNTIME_ENABLED: "true",
      CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_REGISTERED_RECIPIENT_ENABLED: "true",
      CLAIMANT_INTAKE_ENABLED: "true", CLAIMANT_CASE_PROCESSING_ENABLED: "true",
      CLAIMANT_OWNER_PROTECTION_ENABLED: "true" }), transactions };
}
function epoch() { return Math.floor(now.getTime() / 1000); }
function session(changes = {}) { return { aal: "aal2" as const,
  amr: [{ method: "totp", timestamp: epoch() }], expiresAt: epoch() + 3600,
  issuedAt: epoch() - 60, sessionId: ids.session, userId: ids.user, ...changes }; }
