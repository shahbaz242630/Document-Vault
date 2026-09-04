import { createHash } from "node:crypto";

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import {
  CLAIMANT_OFFLINE_CODE_V2_HANDOFF_ROUTES_APPROVED,
  createOfflineCodeV2HandoffPreflightRoute,
  createOfflineCodeV2HandoffRoute,
  getOfflineCodeV2HandoffRouteConfig,
} from "./offline-code-v2-handoff-routes.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

const ids = {
  case: "70000000-0000-4000-8000-000000000001",
  challenge: "70000000-0000-4000-8000-000000000002",
  handoff: "70000000-0000-4000-8000-000000000003",
  request: "70000000-0000-4000-8000-000000000004",
  session: "70000000-0000-4000-8000-000000000005",
  user: "70000000-0000-4000-8000-000000000006",
};
const apiOrigin = "https://api.sanduqkin.test";
const claimantOrigin = "https://claimant.sanduqkin.test";
const now = Date.parse("2026-09-04T12:00:00.000Z");

describe("offline-code V2 authenticated handoff runtime routes", () => {
  it("is concealed before configuration and runtime clients are touched", async () => {
    expect(CLAIMANT_OFFLINE_CODE_V2_HANDOFF_ROUTES_APPROVED).toBe(false);
    const getConfig = vi.fn();
    const createPortalClient = vi.fn();
    const createTransactionClient = vi.fn();
    const response = await app({ getConfig, createPortalClient, createTransactionClient })
      .request(url("issue"), request({ challengeId: ids.challenge }));
    expect(response.status).toBe(404);
    expect(getConfig).not.toHaveBeenCalled();
    expect(createPortalClient).not.toHaveBeenCalled();
    expect(createTransactionClient).not.toHaveBeenCalled();
  });

  it("is concealed by the capability gate before configuration", async () => {
    const deps = approved();
    deps.runtimeConfig = getClaimantRuntimeConfig({ NODE_ENV: "test" });
    const response = await app(deps).request(url("issue"), request({ challengeId: ids.challenge }));
    expect(response.status).toBe(404);
    expect(deps.getConfig).not.toHaveBeenCalled();
    expect(deps.createPortalClient).not.toHaveBeenCalled();
    expect(deps.createTransactionClient).not.toHaveBeenCalled();
  });

  it("does not construct runtime clients for hostile origins or malformed requests", async () => {
    for (const value of [
      { target: url("issue"), init: request({ challengeId: ids.challenge }, { Origin: "https://evil.test" }) },
      { target: "https://alternate.test/claimant/offline-code/v2/handoffs/issue",
        init: request({ challengeId: ids.challenge }) },
      { target: url("issue"), init: request({ challengeId: ids.challenge }, { Authorization: "bad" }) },
      { target: url("issue"), init: request({ challengeId: ids.challenge }, { Cookie: "session=forbidden" }) },
      { target: url("issue"), init: request({ challengeId: ids.challenge }, { "Content-Type": "text/plain" }) },
      { target: url("issue"), init: request({ extra: true }) },
    ]) {
      const deps = approved();
      const response = await app(deps).request(value.target, value.init);
      expect([403, 404]).toContain(response.status);
      expect(deps.createPortalClient).not.toHaveBeenCalled();
      expect(deps.createTransactionClient).not.toHaveBeenCalled();
    }
  });

  it("lazily composes the established session and transaction clients for a safe issue", async () => {
    const deps = approved();
    const response = await app(deps).request(url("issue"), request({ challengeId: ids.challenge }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: {
      authority: "route_possession_only",
      claim_created: false,
      expires_at: new Date(now + 60_000).toISOString(),
      handoff_id: ids.handoff,
      identity_verified: false,
      release_authorized: false,
      transcript_bytes_base64url: deps.evidence.transcript_bytes_base64url,
    } });
    expect(deps.createPortalClient).toHaveBeenCalledOnce();
    expect(deps.createTransactionClient).toHaveBeenCalledOnce();
    expect(deps.portal.getSession).toHaveBeenCalledWith("jwt");
    expect(deps.portal.assert).toHaveBeenCalledWith(ids.user, ids.session);
    expect(deps.transaction.evidence).toHaveBeenCalledWith("issue", {
      sessionId: ids.session, sessionVersion: 2, userId: ids.user,
    }, ids.challenge, ids.request);
  });

  it("allows only the exact authenticated preflight without constructing clients", async () => {
    const deps = approved();
    const response = await app(deps).request(url("complete"), { method: "OPTIONS", headers: {
      Origin: claimantOrigin,
      "Access-Control-Request-Headers": "Authorization, Content-Type, Idempotency-Key",
      "Access-Control-Request-Method": "POST",
    } });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(claimantOrigin);
    expect(deps.createPortalClient).not.toHaveBeenCalled();
    expect(deps.createTransactionClient).not.toHaveBeenCalled();

    const hostile = await app(deps).request(url("complete"), { method: "OPTIONS", headers: {
      Origin: claimantOrigin,
      "Access-Control-Request-Headers": "Authorization, Content-Type, Idempotency-Key, X-Extra",
      "Access-Control-Request-Method": "POST",
    } });
    expect(hostile.status).toBe(404);
  });

  it("accepts only exact distinct HTTPS origins and server-only Supabase configuration", () => {
    const valid = { OFFLINE_CODE_V2_API_ORIGIN: apiOrigin,
      OFFLINE_CODE_V2_CLAIMANT_ORIGIN: claimantOrigin,
      SUPABASE_SERVICE_ROLE_KEY: "server-only", SUPABASE_URL: "https://db.sanduqkin.test" };
    expect(getOfflineCodeV2HandoffRouteConfig(valid)).toEqual({ apiOrigin, claimantOrigin,
      serviceRoleKey: "server-only", supabaseUrl: "https://db.sanduqkin.test" });
    for (const changes of [
      { OFFLINE_CODE_V2_API_ORIGIN: "http://api.sanduqkin.test" },
      { OFFLINE_CODE_V2_API_ORIGIN: `${apiOrigin}/path` },
      { OFFLINE_CODE_V2_CLAIMANT_ORIGIN: apiOrigin },
      { SUPABASE_SERVICE_ROLE_KEY: " " },
      { SUPABASE_URL: "https://db.sanduqkin.test/path" },
    ]) expect(getOfflineCodeV2HandoffRouteConfig({ ...valid, ...changes })).toBeNull();
  });
});

function app(deps: Parameters<typeof createOfflineCodeV2HandoffRoute>[1]) {
  const instance = new Hono();
  for (const action of ["issue", "complete"] as const) {
    const path = `/claimant/offline-code/v2/handoffs/${action}`;
    instance.post(path, createOfflineCodeV2HandoffRoute(action, deps));
    instance.options(path, createOfflineCodeV2HandoffPreflightRoute(deps));
  }
  return instance;
}

function url(action: "issue" | "complete") {
  return `${apiOrigin}/claimant/offline-code/v2/handoffs/${action}`;
}

function request(body: unknown, changes: Record<string, string> = {}) {
  return { method: "POST", headers: { Authorization: "Bearer jwt", "Content-Type": "application/json",
    "Idempotency-Key": ids.request, Origin: claimantOrigin, ...changes }, body: JSON.stringify(body) };
}

function approved() {
  const runtimeConfig = getClaimantRuntimeConfig({ NODE_ENV: "test", CLAIMANT_RUNTIME_ENABLED: "true",
    CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_OFFLINE_CODE_V2_ENABLED: "true" });
  const portal = { activate: vi.fn(), assert: vi.fn().mockResolvedValue({ context: "claimant_portal",
    sessionVersion: 2 }), getSession: vi.fn().mockResolvedValue({ aal: "aal2",
    amr: [{ method: "totp", timestamp: Math.floor(now / 1000) - 30 }],
    expiresAt: Math.floor(now / 1000) + 3600, issuedAt: Math.floor(now / 1000) - 60,
    sessionId: ids.session, userId: ids.user }), revoke: vi.fn() };
  const transcript = {
    protocol: "sanduqkin:claim:offline-code:v2", purpose: "authenticated_case_handoff",
    label: "sanduqkin:claim:offline-code:v2:authenticated-handoff:v1",
    handoff_id: ids.handoff, case_id: ids.case, claimant_user_id: ids.user,
    portal_session_id: ids.session, portal_session_version: 2,
    source_challenge_id: ids.challenge, record_binding_digest: "A".repeat(43),
    expires_at_epoch: (now + 60_000) / 1000, nonce: "a".repeat(64),
  };
  const bytes = Buffer.from(JSON.stringify(transcript));
  const evidence = { handoff_id: ids.handoff, case_id: ids.case, claimant_user_id: ids.user,
    portal_session_id: ids.session, portal_session_version: 2, source_challenge_id: ids.challenge,
    proof_public_key: "A".repeat(43), expires_at: new Date(now + 60_000).toISOString(),
    transcript_bytes_base64url: bytes.toString("base64url"),
    transcript_digest: createHash("sha256").update(bytes).digest("base64url"),
    authority: "route_possession_only" as const, identity_verified: false as const,
    claim_created: false as const, release_authorized: false as const, synthetic_only: true as const };
  const transaction = { evidence: vi.fn().mockResolvedValue(evidence), consume: vi.fn() };
  return { approved: true as const, createPortalClient: vi.fn(() => portal),
    createTransactionClient: vi.fn(() => transaction), evidence,
    getConfig: vi.fn(() => ({ apiOrigin, claimantOrigin, serviceRoleKey: "server-only",
      supabaseUrl: "https://db.sanduqkin.test" })), now: () => now, portal, runtimeConfig, transaction };
}
