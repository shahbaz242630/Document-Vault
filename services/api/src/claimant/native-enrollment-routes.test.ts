import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { NativeEnrollmentAuthorityClientV1 } from "./native-enrollment-authority-client.js";
import { NativeEnrollmentAuthorityError } from "./native-enrollment-authority-client.js";
import {
  CLAIMANT_NATIVE_ENROLLMENT_ROUTE_APPROVED,
  createNativeEnrollmentPreflightRouteV1,
  createNativeEnrollmentRouteV1,
  type NativeEnrollmentRouteAction,
  type NativeEnrollmentRouteConfigV1,
} from "./native-enrollment-routes.js";
import type { NativeEnrollmentTransactionClientV1 } from "./native-enrollment-transaction-client.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

const ids = { claimant: "21000000-0000-4000-8000-000000000002",
  invitation: "51000000-0000-4000-8000-000000000005",
  session: "81000000-0000-4000-8000-000000000018" };
const keyId = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1)).toString("base64");
const publicKey = "BOJTSjUy0I-7oC3eZZ7mK9ADH-LbeFWW71CTAkRrAwhS4PFXWkxjPMcZ3-5f2oYtdk78lsPzDuAFXELCPxhO2MY";
const enabledRuntime = getClaimantRuntimeConfig({ NODE_ENV: "test", CLAIMANT_RUNTIME_ENABLED: "true",
  CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_REGISTERED_RECIPIENT_ENABLED: "true" });

describe("native enrollment HTTP controller", () => {
  it("is hard-concealed by the immutable approval constant before config or CORS", async () => {
    expect(CLAIMANT_NATIVE_ENROLLMENT_ROUTE_APPROVED).toBe(false);
    const getConfig = vi.fn(); const app = routeApp("registrationIssue", { getConfig });
    const response = await request(app, "/registration", { app_attest_key_id: keyId });
    expect(response.status).toBe(404); expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(getConfig).not.toHaveBeenCalled();
  });

  it("derives the claimant/session and returns only the server registration transcript", async () => {
    const authority = authorityClient(); const transactions = transactionClient();
    const app = routeApp("registrationIssue", approved({ authority, transactions }));
    const response = await request(app, "/registration", { app_attest_key_id: keyId });
    expect(response.status).toBe(200); const json = await response.json() as { result: Record<string, unknown> };
    expect(Object.keys(json.result).sort()).toEqual(["challenge", "challenge_bytes"]);
    expect(json.result.challenge).toEqual(expect.objectContaining({ claimant_id: ids.claimant,
      portal_session_id: ids.session, api_audience: "https://api.sanduqkin.test" }));
    expect(transactions.issueRegistrationChallenge).toHaveBeenCalledOnce();
    expect(authority.takeRateLimit).toHaveBeenCalledWith({ action: "registration_issue",
      claimantUserId: ids.claimant, portalSessionId: ids.session });
  });

  it("derives confirmed-address authority and omits client authority fields", async () => {
    const authority = authorityClient(); const transactions = transactionClient();
    const app = routeApp("nativeIssue", approved({ authority, transactions }));
    const body = { app_attest_key_id: keyId, capability: {
      claimed_hardware_security_level: "secure_enclave", claimed_private_key_exportable: false,
      claimed_user_presence_binding: "transaction_bound", key_algorithm: "p256_ecdh", platform: "ios",
      protocol: "sanduqkin:claim:native-enrollment:v1", public_key_encoding: "ansi_x9_63_uncompressed",
    }, invitation_reference: ids.invitation, protocol: "sanduqkin:claim:native-enrollment:v1", public_key: publicKey };
    const response = await request(app, "/native", body);
    expect(response.status).toBe(200);
    expect(authority.getAuthority).toHaveBeenCalledWith(expect.objectContaining({
      claimantUserId: ids.claimant, invitationId: ids.invitation,
      recipientAddressDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    const rpcInput = vi.mocked(transactions.issueNativeChallenge).mock.calls[0]![0];
    expect(rpcInput).toEqual(expect.objectContaining({ eligibilityVersion: 3,
      invitationVersion: 2, recipientAddressDigest: "a".repeat(64) }));
    expect(rpcInput).not.toHaveProperty("confirmedAddress");
    expect(JSON.stringify(await response.json())).not.toContain("Alice.Example");

    const prohibited = await request(app, "/native", { ...body,
      recipient_address_digest: "a".repeat(64), eligibility_version: 3 });
    expect(prohibited.status).toBe(400);
  });

  it("fails closed for stale assurance, rate limit, hidden authority, origin, size, and path mismatch", async () => {
    const staleAuthority = authorityClient({ getConfirmedSession: vi.fn(async () => ({
      ...session(), amr: [{ method: "totp", timestamp: 1 }], issuedAt: 1,
    })) });
    expect((await request(routeApp("registrationIssue", approved({ authority: staleAuthority })),
      "/registration", { app_attest_key_id: keyId })).status).toBe(403);

    const limited = authorityClient({ takeRateLimit: vi.fn(async () => {
      throw new NativeEnrollmentAuthorityError("P0001");
    }) });
    const limitedResponse = await request(routeApp("registrationIssue", approved({ authority: limited })),
      "/registration", { app_attest_key_id: keyId });
    expect(limitedResponse.status).toBe(429); expect(limitedResponse.headers.get("Retry-After")).toBe("900");

    const hidden = authorityClient({ getAuthority: vi.fn(async () => {
      throw new NativeEnrollmentAuthorityError("42501");
    }) });
    const native = routeApp("nativeIssue", approved({ authority: hidden }));
    const invalidOrigin = await native.request("/native", { method: "POST", headers: baseHeaders({ Origin: "https://evil.test" }), body: "{}" });
    expect(invalidOrigin.status).toBe(403); expect(invalidOrigin.headers.get("Access-Control-Allow-Origin")).toBeNull();

    const large = await routeApp("registrationIssue", approved()).request("/registration", {
      method: "POST", headers: baseHeaders(), body: JSON.stringify({ padding: "A".repeat(100_001) }) });
    expect(large.status).toBe(413);

    const completion = routeApp("nativeComplete", approved());
    const mismatch = await request(completion, "/native/71000000-0000-4000-8000-000000000099/complete", {
      app_attest_challenge_id: "71000000-0000-4000-8000-000000000002",
      app_attest_response: { app_attest_key_id: keyId,
        assertion_object: "0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8A",
        challenge_id: "71000000-0000-4000-8000-000000000002",
        protocol: "sanduqkin:claim:native-enrollment:app-attest-assertion:v1" },
      possession_proof: { challenge_id: "71000000-0000-4000-8000-000000000001",
        claimant_id: ids.claimant, claimant_key_id: "31000000-0000-4000-8000-000000000013",
        claimant_key_version: 1, device_binding_digest: "d".repeat(64), invitation_reference: ids.invitation,
        proof_mac: "A".repeat(43), protocol: "sanduqkin:claim:native-enrollment:v1",
        public_key_fingerprint: "A".repeat(43) },
    });
    expect(mismatch.status).toBe(400);
  });

  it("allows only the exact preflight contract when approved", async () => {
    const app = new Hono(); app.options("/native", createNativeEnrollmentPreflightRouteV1(approved()));
    const accepted = await app.request("/native", { method: "OPTIONS", headers: {
      Origin: "https://claimant.sanduqkin.test", "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Authorization, Content-Type, Idempotency-Key",
    } });
    expect(accepted.status).toBe(204);
    const rejected = await app.request("/native", { method: "OPTIONS", headers: {
      Origin: "https://claimant.sanduqkin.test", "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Authorization, X-Extra",
    } });
    expect(rejected.status).toBe(403);
  });

  it("reconciles an exact attempt through server authority", async () => {
    const transactions = transactionClient();
    vi.mocked(transactions.reconcileNativeEnrollment).mockResolvedValueOnce({ status: "not_committed" });
    const app = routeApp("reconcile", approved({ transactions }));
    const attemptId = "71000000-0000-4000-8000-000000000004";
    const response = await request(app, `/attempts/${attemptId}/reconcile`, {
      app_attest_challenge_id: "71000000-0000-4000-8000-000000000002",
      native_challenge_id: "71000000-0000-4000-8000-000000000001",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: { status: "not_committed" } });
    expect(transactions.reconcileNativeEnrollment).toHaveBeenCalledWith(expect.objectContaining({ attemptId,
      claimantUserId: ids.claimant, portalSessionId: ids.session }));
  });
});

function routeApp(action: NativeEnrollmentRouteAction, deps: Parameters<typeof createNativeEnrollmentRouteV1>[1]) {
  const app = new Hono(); const path = action === "reconcile" ? "/attempts/:attemptId/reconcile"
    : action === "nativeComplete" ? "/native/:nativeChallengeId/complete"
    : action.startsWith("registration") ? "/registration" : "/native";
  app.post(path, createNativeEnrollmentRouteV1(action, deps)); return app;
}
function approved(overrides: { authority?: NativeEnrollmentAuthorityClientV1;
  transactions?: NativeEnrollmentTransactionClientV1 } = {}) {
  return { createAuthority: () => overrides.authority ?? authorityClient(),
    createTransactions: () => overrides.transactions ?? transactionClient(), custody: { open: vi.fn(), seal: vi.fn(() => "v1.synthetic.envelope.material") },
    getConfig: () => config(), now: () => new Date("2026-08-12T12:00:00.000Z"), routeApproved: true,
    runtimeConfig: enabledRuntime, trust: { verifyCertificateChain: vi.fn() } } as const;
}
function config(): NativeEnrollmentRouteConfigV1 { return { addressIndexKey: Buffer.alloc(32, 1),
  allowedOrigins: ["https://claimant.sanduqkin.test"], apiAudience: "https://api.sanduqkin.test",
  appIdHash: "A".repeat(43), appAttestEnvironment: "production", appleRootCertificateDer: Buffer.from([1]),
  deviceBindingKey: Buffer.alloc(32, 2), freshAssuranceSeconds: 600, policyPackId: "death-only-v1",
  policyPackVersion: 1, requiredBundleVersion: "1", requiredValidationCategory: 2,
  serverEphemeralMasterKey: Buffer.alloc(32, 3), serviceRoleKey: "service-role", supabaseUrl: "https://supabase.test" }; }
function session() { return { aal: "aal2" as const, amr: [{ method: "totp", timestamp: 1_786_536_000 }],
  confirmedAddress: "Alice.Example@example.com", expiresAt: 1_786_539_600, issuedAt: 1_786_536_000,
  sessionId: ids.session, userId: ids.claimant }; }
function authorityClient(overrides: Partial<NativeEnrollmentAuthorityClientV1> = {}): NativeEnrollmentAuthorityClientV1 {
  return { getAuthority: vi.fn(async () => ({ eligibilityVersion: 3, invitationId: ids.invitation,
    invitationVersion: 2, recipientAddressDigest: "a".repeat(64) })), getConfirmedSession: vi.fn(async () => session()),
    takeRateLimit: vi.fn(async () => ({ allowed: true as const, remaining: 4, retryAfterSeconds: 800 })), ...overrides };
}
function transactionClient(): NativeEnrollmentTransactionClientV1 { const unexpected = vi.fn(async () => { throw new Error("unexpected"); });
  return { acceptNativeEnrollment: unexpected, consumeRegistration: unexpected, getNativeEvidence: unexpected,
    getRegistrationChallenge: unexpected, issueNativeChallenge: vi.fn(async (input) => ({
      appAttestChallengeId: input.material.appAttestChallenge.challenge_id,
      expiresAt: input.material.nativeChallenge.expires_at,
      nativeChallengeId: input.material.nativeChallenge.challenge_id, replayed: false })),
    issueRegistrationChallenge: vi.fn(async (input) => ({ challengeId: input.material.challenge.challenge_id,
      expiresAt: input.material.challenge.expires_at, replayed: false })),
    reconcileNativeEnrollment: vi.fn(async () => ({ status: "unknown" as const })) } as NativeEnrollmentTransactionClientV1; }
function baseHeaders(extra: Record<string, string> = {}) { return { Authorization: "Bearer header.payload.signature",
  "Content-Type": "application/json", "Idempotency-Key": "71000000-0000-4000-8000-000000000004",
  Origin: "https://claimant.sanduqkin.test", ...extra }; }
function request(app: Hono, path: string, body: unknown) { return app.request(path,
  { method: "POST", headers: baseHeaders(), body: JSON.stringify(body) }); }
