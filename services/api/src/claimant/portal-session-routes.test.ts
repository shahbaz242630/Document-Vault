import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClaimantPortalSessionError, type ClaimantPortalSessionClient } from "./portal-session-client.js";
import { createClaimantPortalPreflightRoute, createClaimantPortalSessionRoute } from "./portal-session-routes.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

const userId = "10000000-0000-4000-8000-000000000001";
const sessionId = "20000000-0000-4000-8000-000000000002";
const idempotencyKey = "30000000-0000-4000-8000-000000000003";
const origin = "https://app.synthetic.test";
const now = 1_800_000_000;

describe("claimant portal session boundary", () => {
  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(now * 1000));

  it("conceals every portal session route while authentication is disabled", async () => {
    const app = createApp(clientDouble(), getClaimantRuntimeConfig({ NODE_ENV: "test" }));
    for (const action of ["activate", "assert", "revoke"]) {
      const response = await app.request(`/portal/${action}`, requestOptions());
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
    }
  });

  it("activates only the server-derived eligible claimant portal context", async () => {
    const client = clientDouble();
    const response = await createApp(client).request("/portal/activate", requestOptions());
    expect(response.status).toBe(200);
    expect(client.activate).toHaveBeenCalledWith({
      authenticatedAt: new Date(now * 1000).toISOString(),
      idempotencyKey, sessionId, userId,
    });
    expect(await response.json()).toEqual({
      result: { context: "claimant_portal", displacedPrevious: false, replayed: false, sessionVersion: 1 },
    });
  });

  it("conceals arbitrary, owner-only, ineligible, and ambiguous identities", async () => {
    const client = clientDouble();
    client.activate.mockRejectedValue(new ClaimantPortalSessionError({ code: "42501" }));
    const response = await createApp(client).request("/portal/activate", requestOptions());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("fails closed for AAL1, recovery, stale assurance, and displaced sessions", async () => {
    for (const session of [
      { ...freshSession, aal: "aal1" as const },
      { ...freshSession, amr: [{ method: "recovery", timestamp: now }] },
      { ...freshSession, amr: [{ method: "mfa/totp", timestamp: now - 601 }] },
    ]) {
      const client = clientDouble();
      client.getSession.mockResolvedValue(session);
      const response = await createApp(client).request("/portal/assert", requestOptions());
      expect(response.status).toBe(403);
      expect(client.assert).not.toHaveBeenCalled();
    }
    const displaced = clientDouble();
    displaced.assert.mockRejectedValue(new ClaimantPortalSessionError({ code: "28000" }));
    const response = await createApp(displaced).request("/portal/assert", requestOptions());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Session inactive" });
  });

  it("enforces the claimant origin, strict empty body, and exact preflight", async () => {
    const app = createApp(clientDouble());
    expect((await app.request("/portal/activate", requestOptions({}, "https://vault.sanduqkin.com"))).status).toBe(403);
    expect((await app.request("/portal/activate", requestOptions({ role: "claimant" }))).status).toBe(400);
    const preflight = await app.request("/portal/activate", {
      headers: {
        "Access-Control-Request-Headers": "authorization, content-type, idempotency-key",
        "Access-Control-Request-Method": "POST",
        Origin: origin,
      }, method: "OPTIONS",
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });
});

function createApp(
  client: ReturnType<typeof clientDouble>,
  runtimeConfig = enabledRuntimeConfig,
) {
  const app = new Hono();
  const deps = {
    createClient: () => client as unknown as ClaimantPortalSessionClient,
    getConfig: () => ({
      allowedOrigins: [origin], freshAssuranceSeconds: 600,
      serviceRoleKey: "service-role", supabaseUrl: "http://localhost:54321",
    }), runtimeConfig,
  };
  for (const action of ["activate", "assert", "revoke"] as const) {
    app.post(`/portal/${action}`, createClaimantPortalSessionRoute(action, deps));
    app.options(`/portal/${action}`, createClaimantPortalPreflightRoute(deps));
  }
  return app;
}

function clientDouble() {
  return {
    activate: vi.fn().mockResolvedValue({
      context: "claimant_portal", displacedPrevious: false, replayed: false, sessionVersion: 1,
    }),
    assert: vi.fn().mockResolvedValue({ context: "claimant_portal", sessionVersion: 1 }),
    getSession: vi.fn().mockResolvedValue(freshSession),
    revoke: vi.fn().mockResolvedValue({
      context: "claimant_portal", replayed: false, revoked: true, sessionVersion: 2,
    }),
  };
}

function requestOptions(body: object = {}, requestOrigin = origin) {
  return {
    body: JSON.stringify(body),
    headers: {
      Authorization: "Bearer synthetic-token", "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey, Origin: requestOrigin,
    }, method: "POST",
  };
}

const freshSession = {
  aal: "aal2" as const, amr: [{ method: "mfa/totp", timestamp: now }],
  expiresAt: now + 3600, issuedAt: now - 30, sessionId, userId,
};

const enabledRuntimeConfig = getClaimantRuntimeConfig({
  CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_RUNTIME_ENABLED: "true", NODE_ENV: "test",
});
