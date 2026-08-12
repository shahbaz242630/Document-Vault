import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { RegisteredRecipientClient } from "./registered-recipient-client.js";
import {
  createEnrollClaimantDeviceRoute, createFinalizeRegisteredRecipientRoute,
  createReplaceClaimantDeviceRoute, createRevokeClaimantDeviceRoute,
  createRevokeRegisteredInvitationRoute,
} from "./registered-recipient-lifecycle-routes.js";
import { createRegisteredRecipientPreflightRoute } from "./registered-recipient-routes.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

describe("registered-recipient lifecycle routes", () => {
  it("derives the claimant for second-device enrollment and rejects private material", async () => {
    const client = clientDouble();
    const app = createApp(client);
    const accepted = await app.request(`/cases/${caseId}/device-keys`, request(keyBody));
    const privateKey = await app.request(`/cases/${caseId}/device-keys`, request({
      ...keyBody, publicKeyJwk: { ...keyBody.publicKeyJwk, d: "secret" },
    }));

    expect(accepted.status).toBe(200);
    expect(client.manageLifecycle).toHaveBeenCalledWith({
      action: "enroll", actorUserId: userId, caseId, deviceBindingDigest: digest,
      expectedCaseVersion: 2, grants: null, idempotencyKey,
      publicKeyJwk: keyBody.publicKeyJwk, targetKeyId: null,
    });
    expect(privateKey.status).toBe(400);
    expect(client.manageLifecycle).toHaveBeenCalledTimes(1);
  });

  it("binds replacement and revocation to the URL case and key", async () => {
    const client = clientDouble();
    const app = createApp(client);
    const replace = await app.request(`/cases/${caseId}/device-keys/${keyId}/replace`, request(keyBody));
    const revoke = await app.request(`/cases/${caseId}/device-keys/${keyId}/revoke`, request({ expectedCaseVersion: 3 }));

    expect(replace.status).toBe(200);
    expect(revoke.status).toBe(200);
    expect(client.manageLifecycle.mock.calls[0][0]).toMatchObject({
      action: "replace", actorUserId: userId, caseId, targetKeyId: keyId,
    });
    expect(client.manageLifecycle.mock.calls[1][0]).toEqual({
      action: "revoke", actorUserId: userId, caseId, deviceBindingDigest: null,
      expectedCaseVersion: 3, grants: null, idempotencyKey,
      publicKeyJwk: null, targetKeyId: keyId,
    });
  });

  it("accepts exactly allowlisted V2 ciphertext grants for owner finalization", async () => {
    const client = clientDouble();
    const app = createApp(client);
    const grants = [grant(keyId), grant(secondKeyId)];
    const response = await app.request(`/cases/${caseId}/finalize`, request({
      expectedCaseVersion: 4, grants,
    }));
    const plaintext = await app.request(`/cases/${caseId}/finalize`, request({
      expectedCaseVersion: 4, grants: grants.map((item) => ({ ...item, mek: "secret" })),
    }));

    expect(response.status).toBe(200);
    expect(client.manageLifecycle).toHaveBeenCalledWith({
      action: "finalize", actorUserId: userId, caseId, deviceBindingDigest: null,
      expectedCaseVersion: 4, grants, idempotencyKey, publicKeyJwk: null, targetKeyId: null,
    });
    expect(plaintext.status).toBe(400);
  });

  it("revokes a pending invitation using only the verified owner", async () => {
    const client = clientDouble();
    const response = await createApp(client).request(`/invitations/${invitationId}/revoke`,
      request({ expectedInvitationVersion: 1 }));

    expect(response.status).toBe(200);
    expect(client.revokeInvitation).toHaveBeenCalledWith({
      expectedVersion: 1, idempotencyKey, invitationId, ownerUserId: userId,
    });
  });

  it("conceals lifecycle endpoints while disabled and permits only explicit preflight", async () => {
    const client = clientDouble();
    const disabled = createApp(client, getClaimantRuntimeConfig({ NODE_ENV: "test" }));
    expect((await disabled.request(`/cases/${caseId}/device-keys`, request(keyBody))).status).toBe(404);

    const preflight = await createApp(client).request(`/cases/${caseId}/device-keys`, {
      headers: {
        "Access-Control-Request-Headers": "authorization, content-type, idempotency-key",
        "Access-Control-Request-Method": "POST", Origin: origin,
      }, method: "OPTIONS",
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });
});

function createApp(client: ReturnType<typeof clientDouble>, runtimeConfig = enabledConfig) {
  const app = new Hono();
  const deps = { createClient: () => client as unknown as RegisteredRecipientClient,
    getConfig: () => routeConfig, runtimeConfig };
  app.post("/cases/:caseId/device-keys", createEnrollClaimantDeviceRoute(deps));
  app.post("/cases/:caseId/device-keys/:keyId/replace", createReplaceClaimantDeviceRoute(deps));
  app.post("/cases/:caseId/device-keys/:keyId/revoke", createRevokeClaimantDeviceRoute(deps));
  app.post("/cases/:caseId/finalize", createFinalizeRegisteredRecipientRoute(deps));
  app.post("/invitations/:invitationId/revoke", createRevokeRegisteredInvitationRoute(deps));
  app.options("/cases/:caseId/device-keys", createRegisteredRecipientPreflightRoute(deps));
  return app;
}

function clientDouble() {
  return {
    assertActiveSession: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(session),
    manageLifecycle: vi.fn().mockResolvedValue(lifecycleResult),
    revokeInvitation: vi.fn().mockResolvedValue({
      invitationId, invitationVersion: 2, replayed: false, revoked: true,
    }),
  };
}

function request(body: unknown) {
  return { body: JSON.stringify(body), headers: { Authorization: "Bearer session",
    "Content-Type": "application/json", "Idempotency-Key": idempotencyKey, Origin: origin },
  method: "POST" };
}

function grant(recipientKeyId: string) {
  return { aead: "xchacha20poly1305_ietf", ciphertext: "A".repeat(64),
    created_at: "2026-08-04T12:00:00.000Z", grant_id: crypto.randomUUID(), grant_version: 1,
    kdf: "hkdf_sha256", key_agreement: "p256_ecdh", nonce: "B".repeat(32),
    owner_ephemeral_public_key: "C".repeat(87), profile: "registered_recipient_v2",
    protocol: "sanduqkin:claim:recipient-grant:v2", recipient_id: userId,
    recipient_key_id: recipientKeyId, recipient_key_version: 1, revoked_at: null } as const;
}

const now = Math.floor(Date.now() / 1000);
const userId = "10000000-0000-4000-8000-000000000001";
const caseId = "20000000-0000-4000-8000-000000000002";
const keyId = "30000000-0000-4000-8000-000000000003";
const secondKeyId = "40000000-0000-4000-8000-000000000004";
const invitationId = "50000000-0000-4000-8000-000000000005";
const idempotencyKey = "60000000-0000-4000-8000-000000000006";
const digest = "a".repeat(64);
const origin = "https://claimant.test";
const session = { aal: "aal2", amr: [{ method: "mfa/totp", timestamp: now }],
  expiresAt: now + 3600, issuedAt: now, sessionId: "70000000-0000-4000-8000-000000000007", userId } as const;
const keyBody = { deviceBindingDigest: digest, expectedCaseVersion: 2,
  publicKeyJwk: { crv: "P-256", kty: "EC", x: "x".repeat(43), y: "y".repeat(43) } } as const;
const lifecycleResult = { action: "enroll", bindingVersion: 2, caseId, caseVersion: 2,
  claimantKeyId: keyId, finalizationVersion: 0, replayed: false } as const;
const routeConfig = { allowedOrigins: [origin], freshAssuranceSeconds: 600,
  serviceRoleKey: "service-role", supabaseUrl: "http://localhost:54321" };
const enabledConfig = getClaimantRuntimeConfig({ CLAIMANT_AUTHENTICATION_ENABLED: "true",
  CLAIMANT_REGISTERED_RECIPIENT_ENABLED: "true", CLAIMANT_RUNTIME_ENABLED: "true", NODE_ENV: "test" });
