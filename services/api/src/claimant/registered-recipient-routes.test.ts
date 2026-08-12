import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import {
  RegisteredRecipientMutationError,
  type RegisteredRecipientClient,
} from "./registered-recipient-client.js";
import {
  createAcceptRegisteredInvitationRoute,
  createActivateClaimantSessionRoute,
  createIssueRegisteredInvitationRoute,
  createRegisteredRecipientPreflightRoute,
  createRevokeClaimantSessionRoute,
} from "./registered-recipient-routes.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

describe("registered-recipient routes", () => {
  it("conceals every route while the capability is disabled", async () => {
    const createClient = vi.fn();
    const app = createApp(createClient, getClaimantRuntimeConfig({ NODE_ENV: "test" }));

    const post = await app.request(issuePath, requestOptions(issueBody));
    const preflight = await app.request(issuePath, preflightOptions());

    expect(post.status).toBe(404);
    expect(preflight.status).toBe(404);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("allows only exact configured origins and an explicit preflight shape", async () => {
    const app = createApp(() => clientDouble());

    const accepted = await app.request(issuePath, preflightOptions());
    const wrongOrigin = await app.request(issuePath, preflightOptions("https://evil.example"));
    const extraHeader = await app.request(issuePath, {
      ...preflightOptions(),
      headers: {
        ...preflightOptions().headers,
        "Access-Control-Request-Headers": "authorization, content-type, idempotency-key, x-extra",
      },
    });

    expect(accepted.status).toBe(204);
    expect(accepted.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
    expect(accepted.headers.get("Access-Control-Allow-Headers")).toBe(
      "Authorization, Content-Type, Idempotency-Key",
    );
    expect(wrongOrigin.status).toBe(403);
    expect(extraHeader.status).toBe(403);
  });

  it("rejects missing auth, non-exact content types, invalid idempotency, and oversized bodies", async () => {
    const createClient = vi.fn(() => clientDouble());
    const app = createApp(createClient);

    const noAuth = await app.request(issuePath, requestOptions(issueBody, { Authorization: "" }));
    const contentType = await app.request(issuePath, requestOptions(issueBody, {
      "Content-Type": "application/json; charset=utf-8",
    }));
    const idempotency = await app.request(issuePath, requestOptions(issueBody, {
      "Idempotency-Key": "not-a-uuid",
    }));
    const oversized = await app.request(issuePath, requestOptions({ padding: "x".repeat(9000) }));

    expect(noAuth.status).toBe(401);
    expect(contentType.status).toBe(415);
    expect(idempotency.status).toBe(400);
    expect(oversized.status).toBe(413);
  });

  it("derives the owner identity and rejects actor-spoofing fields", async () => {
    const client = clientDouble();
    const app = createApp(() => client);

    const accepted = await app.request(issuePath, requestOptions(issueBody));
    const spoofed = await app.request(issuePath, requestOptions({
      ...issueBody,
      ownerUserId: "90000000-0000-4000-8000-000000000009",
    }));

    expect(accepted.status).toBe(200);
    expect(client.getSession).toHaveBeenCalledWith("signed-session");
    expect(client.issueInvitation).toHaveBeenCalledWith({
      ...issueBody,
      idempotencyKey,
      ownerUserId,
    });
    expect(spoofed.status).toBe(400);
    expect(client.issueInvitation).toHaveBeenCalledTimes(1);
  });

  it("derives claimant identity and passes only validated public-key acceptance input", async () => {
    const client = clientDouble();
    const app = createApp(() => client);

    const response = await app.request(acceptPath, requestOptions(acceptBody));

    expect(response.status).toBe(200);
    expect(client.acceptInvitation).toHaveBeenCalledWith({
      ...acceptBody,
      claimantUserId: ownerUserId,
      idempotencyKey,
      invitationId,
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects private JWK material and claimant identity spoofing", async () => {
    const client = clientDouble();
    const app = createApp(() => client);
    const privateKey = await app.request(acceptPath, requestOptions({
      ...acceptBody,
      publicKeyJwk: { ...acceptBody.publicKeyJwk, d: "secret" },
    }));
    const spoofed = await app.request(acceptPath, requestOptions({
      ...acceptBody,
      claimantUserId: "90000000-0000-4000-8000-000000000009",
    }));

    expect(privateKey.status).toBe(400);
    expect(spoofed.status).toBe(400);
    expect(client.acceptInvitation).not.toHaveBeenCalled();
  });

  it("returns replay results while redacting authentication and database failures", async () => {
    const replayClient = clientDouble({ ...issueResult, replayed: true });
    const replayApp = createApp(() => replayClient);
    const replay = await replayApp.request(issuePath, requestOptions(issueBody));
    expect(await replay.json()).toEqual({ result: { ...issueResult, replayed: true } });

    const authClient = clientDouble();
    authClient.getSession.mockRejectedValue(new Error("Supabase token detail"));
    const unauthorized = await createApp(() => authClient).request(issuePath, requestOptions(issueBody));
    expect(await unauthorized.json()).toEqual({ error: "Unauthorized" });

    const mutationClient = clientDouble();
    mutationClient.issueInvitation.mockRejectedValue(
      new RegisteredRecipientMutationError({ code: "22023", message: "sensitive database detail" }),
    );
    const conflict = await createApp(() => mutationClient).request(issuePath, requestOptions(issueBody));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: "Request conflict" });
  });

  it("activates a fresh AAL2 session and reports displacement without accepting actor input", async () => {
    const client = clientDouble();
    client.activateSession.mockResolvedValue({
      displacedPrevious: true,
      replayed: false,
      sessionVersion: 2,
    });
    const response = await createApp(() => client).request(
      activatePath,
      requestOptions({}),
    );

    expect(response.status).toBe(200);
    expect(client.activateSession).toHaveBeenCalledWith({
      authenticatedAt: new Date(nowEpochSeconds * 1000).toISOString(),
      idempotencyKey,
      sessionId: session.sessionId,
      userId: ownerUserId,
    });
    expect(await response.json()).toEqual({
      result: { displacedPrevious: true, replayed: false, sessionVersion: 2 },
    });
  });

  it("requires fresh non-recovery AAL2 and an active server-owned session", async () => {
    for (const rejectedSession of [
      { ...session, aal: "aal1" as const },
      { ...session, amr: [{ method: "mfa/totp", timestamp: nowEpochSeconds - 601 }] },
      { ...session, amr: [...session.amr, { method: "recovery", timestamp: nowEpochSeconds }] },
    ]) {
      const client = clientDouble();
      client.getSession.mockResolvedValue(rejectedSession);
      const response = await createApp(() => client).request(issuePath, requestOptions(issueBody));
      expect(response.status).toBe(403);
      expect(client.issueInvitation).not.toHaveBeenCalled();
    }

    const displaced = clientDouble();
    displaced.assertActiveSession.mockRejectedValue(
      new RegisteredRecipientMutationError({ code: "28000" }),
    );
    const response = await createApp(() => displaced).request(issuePath, requestOptions(issueBody));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Session inactive" });
  });

  it("revokes only the verified active session with fresh assurance", async () => {
    const client = clientDouble();
    const response = await createApp(() => client).request(revokePath, requestOptions({}));

    expect(response.status).toBe(200);
    expect(client.revokeSession).toHaveBeenCalledWith({
      idempotencyKey,
      sessionId: session.sessionId,
      userId: ownerUserId,
    });
  });
});

function createApp(
  createClient: () => RegisteredRecipientClient,
  runtimeConfig = enabledRuntimeConfig,
) {
  const app = new Hono();
  const deps = { createClient, getConfig: () => routeConfig, runtimeConfig };
  app.options(issuePath, createRegisteredRecipientPreflightRoute(deps));
  app.options("/accept/:invitationId", createRegisteredRecipientPreflightRoute(deps));
  app.options(activatePath, createRegisteredRecipientPreflightRoute(deps));
  app.options(revokePath, createRegisteredRecipientPreflightRoute(deps));
  app.post(issuePath, createIssueRegisteredInvitationRoute(deps));
  app.post("/accept/:invitationId", createAcceptRegisteredInvitationRoute(deps));
  app.post(activatePath, createActivateClaimantSessionRoute(deps));
  app.post(revokePath, createRevokeClaimantSessionRoute(deps));
  return app;
}

function clientDouble(result = issueResult) {
  return {
    acceptInvitation: vi.fn().mockResolvedValue(result),
    activateSession: vi.fn().mockResolvedValue({
      displacedPrevious: false,
      replayed: false,
      sessionVersion: 1,
    }),
    assertActiveSession: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(session),
    issueInvitation: vi.fn().mockResolvedValue(result),
    manageLifecycle: vi.fn().mockResolvedValue({
      action: "enroll", bindingVersion: 2, caseId: invitationId,
      caseVersion: 2, claimantKeyId: invitationId, finalizationVersion: 0, replayed: false,
    }),
    revokeInvitation: vi.fn().mockResolvedValue({
      invitationId, invitationVersion: 2, replayed: false, revoked: true,
    }),
    revokeSession: vi.fn().mockResolvedValue({ replayed: false, revoked: true, sessionVersion: 2 }),
  };
}

function requestOptions(body: unknown, headerOverrides: Record<string, string> = {}) {
  return {
    body: JSON.stringify(body),
    headers: {
      Authorization: "Bearer signed-session",
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      Origin: allowedOrigin,
      ...headerOverrides,
    },
    method: "POST",
  };
}

function preflightOptions(origin = allowedOrigin) {
  return {
    headers: {
      "Access-Control-Request-Headers": "authorization, content-type, idempotency-key",
      "Access-Control-Request-Method": "POST",
      Origin: origin,
    },
    method: "OPTIONS",
  };
}

const enabledRuntimeConfig = getClaimantRuntimeConfig({
  CLAIMANT_AUTHENTICATION_ENABLED: "true",
  CLAIMANT_REGISTERED_RECIPIENT_ENABLED: "true",
  CLAIMANT_RUNTIME_ENABLED: "true",
  NODE_ENV: "test",
});
const allowedOrigin = "https://claimant.test";
const routeConfig = {
  allowedOrigins: [allowedOrigin],
  freshAssuranceSeconds: 600,
  serviceRoleKey: "service-role",
  supabaseUrl: "http://localhost:54321",
};
const ownerUserId = "10000000-0000-4000-8000-000000000001";
const invitationId = "30000000-0000-4000-8000-000000000003";
const idempotencyKey = "50000000-0000-4000-8000-000000000005";
const digest = "a".repeat(64);
const issuePath = "/invitations";
const acceptPath = `/accept/${invitationId}`;
const activatePath = "/session/activate";
const revokePath = "/session/revoke";
const issueBody = {
  expiresAt: "2026-08-05T12:00:00.000Z",
  recipientAddressDigest: digest,
};
const issueResult = {
  invitationId,
  invitationVersion: 1,
  replayed: false,
};
const acceptBody = {
  deviceBindingDigest: digest,
  expectedInvitationVersion: 1,
  policyPackId: "death-only-v1",
  policyPackVersion: 1,
  publicKeyJwk: { crv: "P-256", kty: "EC", x: "x".repeat(43), y: "y".repeat(43) },
  recipientAddressDigest: digest,
};
const nowEpochSeconds = Math.floor(Date.now() / 1000);
const session = {
  aal: "aal2" as const,
  amr: [{ method: "mfa/totp", timestamp: nowEpochSeconds }],
  expiresAt: nowEpochSeconds + 3600,
  issuedAt: nowEpochSeconds,
  sessionId: "70000000-0000-4000-8000-000000000007",
  userId: ownerUserId,
};
