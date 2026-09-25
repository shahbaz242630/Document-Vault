import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, type OfflineCodeChallengeV2, type OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import type { OfflineCodeV2SyntheticAttempt } from "../claimant-offline-code/offline-code-v2-coordinator";
import { completion, id, session as portalSession, signature, transcript } from "../claimant-handoff/fixtures.test";
import type { HandoffSend } from "../claimant-handoff/transport";
import type { PortalSessionSend } from "../claimant-session/portal-session-client";
import { createClaimantRuntimeFoundation } from "./runtime-foundation";

const unavailable = { name: "ClaimantRuntimeFoundationUnavailableError",
  message: "Claimant runtime foundation is unavailable." };
const issuer = "https://identity.sanduqkin.test";
const keyAlias = "claimant-handoff.test.v1.synthetic_key_001";
const keyFingerprint = "B".repeat(43);
type Options = Parameters<typeof createClaimantRuntimeFoundation>[0];

function portalResponse(result: unknown) {
  return Response.json({ result }, { headers: { "Access-Control-Allow-Origin": "https://app.sanduqkin.test",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin" } });
}

function harness() {
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(),
    "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8")) as {
      public_locator: OfflineCodeV2SyntheticAttempt["publicLocator"];
      synthetic_client_secret: OfflineCodeV2SyntheticAttempt["clientSecret"];
      kdf_profile: OfflineCodeV2SyntheticAttempt["kdfProfile"];
      record_binding: OfflineCodeV2SyntheticAttempt["recordBinding"];
      challenge: OfflineCodeChallengeV2; possession_proof: OfflineCodePossessionProofV2;
    };
  let time = Date.parse(fixture.challenge.issued_at) + 1_000;
  const authenticated = Object.freeze({ syntheticOnly: true as const, status: "authenticated" as const,
    userId: portalSession.userId, sessionId: portalSession.sessionId, accessToken: portalSession.accessToken,
    aal: "aal2" as const, recovery: false as const, expiresAt: time + 600_000, assuredAt: time,
    issuer, audience: "authenticated" as const });
  const authListeners = new Set<(value: unknown) => void>();
  const lifecycleListeners = new Set<(value: unknown) => void>();
  let lifecycle = { sequence: 0, state: "foreground" };
  const provider = { syntheticOnly: true as const, subscribe(listener: (value: unknown) => void) {
    authListeners.add(listener); listener(authenticated); return () => { authListeners.delete(listener); };
  } };
  const lifecycleSource = { subscribe(listener: (value: unknown) => void) {
    lifecycleListeners.add(listener); listener(lifecycle); return () => { lifecycleListeners.delete(listener); };
  } };
  const portalResults = {
    activate: { context: "claimant_portal", sessionVersion: 1, displacedPrevious: false, replayed: false },
    assert: { context: "claimant_portal", sessionVersion: 1 },
    revoke: { context: "claimant_portal", sessionVersion: 1, revoked: true, replayed: false },
  } as const;
  const portalSend = vi.fn<PortalSessionSend>(async (url) =>
    portalResponse(portalResults[url.split("/").at(-1) as keyof typeof portalResults]));
  const proofResult = { status: "proof_verified", authority: "route_possession_only",
    route_possession_asserted: true, identity_verified: false, claim_created: false, release_authorized: false };
  const possessionResponse = (proof: boolean) => Response.json({ result: proof ? proofResult : {
    status: "challenge_issued", authority: "route_possession_only", challenge: fixture.challenge,
    challenge_bytes_base64url: Buffer.from(canonicalJson(fixture.challenge as never)).toString("base64url"),
    kdf_profile: fixture.kdf_profile, identity_verified: false, claim_created: false, release_authorized: false,
  } }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": fixture.challenge.origin } });
  const possessionSend = vi.fn<typeof fetch>(async (url) => possessionResponse(String(url).endsWith("/proofs")));
  const sourceTranscript = { ...transcript, claimant_user_id: authenticated.userId,
    portal_session_id: authenticated.sessionId, portal_session_version: 1,
    source_challenge_id: fixture.challenge.challenge_id,
    record_binding_digest: fixture.challenge.record_binding_digest, expires_at_epoch: (time + 120_000) / 1000 };
  const issued = { handoff_id: id(6),
    transcript_bytes_base64url: Buffer.from(JSON.stringify(sourceTranscript)).toString("base64url"),
    expires_at: new Date(time + 120_000).toISOString(), authority: "route_possession_only",
    identity_verified: false, claim_created: false, release_authorized: false };
  const handoffResponse = (result: unknown) => Response.json({ result }, { headers: {
    "Cache-Control": "private, no-store", "Access-Control-Allow-Origin": fixture.challenge.origin,
    "X-Robots-Tag": "noindex, nofollow" } });
  const handoffSend = vi.fn<HandoffSend>(async (url) => handoffResponse(url.endsWith("/issue") ? issued : completion));
  const producer = { produce: vi.fn(async () => fixture.possession_proof) };
  const nativeResult = { synthetic_only: true, status: "signed",
    signature, key_alias_reference: keyAlias, key_fingerprint: keyFingerprint,
    user_presence: "verified", private_key_exportable: false } as const;
  const signClaimantHandoffAsync = vi.fn(async (_value: unknown) => nativeResult);
  const native = { syntheticOnly: true as const, signClaimantHandoffAsync };
  const possession = { syntheticOnly: true as const, publicLocator: fixture.public_locator,
    clientSecret: fixture.synthetic_client_secret, kdfProfile: fixture.kdf_profile,
    recordBinding: fixture.record_binding, challengeIdempotencyKey: id(91), proofIdempotencyKey: id(92) };
  const attempt = { possession, issueIdempotencyKey: id(93), completionIdempotencyKey: id(94) };
  const options: Options = { approved: true, syntheticOnly: true, productionRuntime: false,
    identity: { expectedIssuer: issuer, provider, now: () => time },
    signing: { keyAliasReference: keyAlias, keyFingerprint, native },
    journey: { lifecycle: lifecycleSource, now: () => time,
      portal: { apiOrigin: "https://api.sanduqkin.test", claimantOrigin: fixture.challenge.origin, send: portalSend },
      bridge: { apiOrigin: "https://api.sanduqkin.test", claimantOrigin: fixture.challenge.origin,
        possessionSend, handoffSend, producer } } };
  return { options, attempt, authenticated, portalResults, portalSend, possessionSend, possessionResponse, handoffSend,
    handoffResponse, issued, producer, native, nativeResult, signClaimantHandoffAsync,
    emitAuth: (value: unknown) => { for (const listener of authListeners) listener(value); },
    emitLifecycle: (state: string) => { lifecycle = { sequence: lifecycle.sequence + 1, state };
      for (const listener of lifecycleListeners) listener(lifecycle); } };
}

describe("claimant runtime foundation", () => {
  it("is dormant by default without reading identity, native, lifecycle or transports", async () => {
    const touched = vi.fn(() => { throw new Error("dependency detail"); });
    const runtime = createClaimantRuntimeFoundation(Object.defineProperties({}, Object.fromEntries([
      "syntheticOnly", "productionRuntime", "identity", "signing", "journey"
    ].map((key) => [key, { get: touched }]))) as Options);
    await expect(runtime.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    expect(runtime.snapshot().status).toBe("disabled"); expect(touched).not.toHaveBeenCalled();
  });

  it("composes hosted AAL2, portal assertion, possession and native signing into a safe draft", async () => {
    const h = harness(); const runtime = createClaimantRuntimeFoundation(h.options);
    await runtime.activatePortal(id(101));
    const draft = await runtime.start({ attempt: h.attempt, sessionAssertionIdempotencyKey: id(102) });
    expect(draft).toEqual({ state: "draft", route_profile: "offline_code_v2", case_version: 1,
      claimant_session_bound: true, case_created: true, identity_verified: false,
      relationship_verified: false, intake_started: false, review_started: false, release_authorized: false });
    expect(h.portalSend.mock.calls.map(([url]) => url.split("/").at(-1))).toEqual(["activate", "assert"]);
    expect(h.signClaimantHandoffAsync).toHaveBeenCalledOnce();
    expect(h.signClaimantHandoffAsync.mock.calls[0]?.[0]).toMatchObject({ key_alias_reference: keyAlias,
      challenge_id: expect.any(String) });
    expect(runtime.snapshot()).toEqual({ status: "draft", portal_session_active: true,
      draft_available: true, identity_verified: false, relationship_verified: false,
      intake_started: false, review_started: false, release_authorized: false });
    await runtime.dispose();
  });

  it("fails composition closed for invalid hosted identity before any adapter work", async () => {
    const h = harness(); const runtime = createClaimantRuntimeFoundation({ ...h.options,
      identity: { ...h.options.identity, expectedIssuer: "https://substituted.test" } });
    expect(runtime.snapshot().status).toBe("closed");
    await expect(runtime.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    expect(h.portalSend).not.toHaveBeenCalled(); expect(h.possessionSend).not.toHaveBeenCalled();
    expect(h.signClaimantHandoffAsync).not.toHaveBeenCalled();
  });

  it("fails server assertion before possession or native signing", async () => {
    const h = harness(); const runtime = createClaimantRuntimeFoundation(h.options);
    await runtime.activatePortal(id(101));
    h.portalSend.mockResolvedValueOnce(portalResponse({ context: "claimant_portal", sessionVersion: 2 }));
    await expect(runtime.start({ attempt: h.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    expect(h.possessionSend).not.toHaveBeenCalled(); expect(h.signClaimantHandoffAsync).not.toHaveBeenCalled();
    expect(runtime.snapshot().status).toBe("closed");
  });

  it("delegates only the exact ambiguous portal activation retry", async () => {
    const h = harness(); h.portalSend.mockRejectedValueOnce(new Error("lost activation response"));
    const runtime = createClaimantRuntimeFoundation(h.options);
    await expect(runtime.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    await expect(runtime.retryActivation()).resolves.toBeUndefined();
    expect(h.portalSend.mock.calls[0]?.[0]).toBe(h.portalSend.mock.calls[1]?.[0]);
    expect(h.portalSend.mock.calls[0]?.[1].headers).toBe(h.portalSend.mock.calls[1]?.[1].headers);
  });

  it("delegates the exact proof retry before native signing", async () => {
    const h = harness(); h.possessionSend.mockImplementationOnce(async () => h.possessionResponse(false))
      .mockRejectedValueOnce(new Error("lost proof response"));
    const runtime = createClaimantRuntimeFoundation(h.options); await runtime.activatePortal(id(101));
    await expect(runtime.start({ attempt: h.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    await expect(runtime.retryProof(id(103))).resolves.toMatchObject({ state: "draft" });
    expect(h.producer.produce).toHaveBeenCalledOnce(); expect(h.signClaimantHandoffAsync).toHaveBeenCalledOnce();
  });

  it("retries an ambiguous completion without invoking native signing twice", async () => {
    const h = harness(); h.handoffSend.mockImplementationOnce(async () => h.handoffResponse(h.issued))
      .mockRejectedValueOnce(new Error("lost completion response"));
    const runtime = createClaimantRuntimeFoundation(h.options); await runtime.activatePortal(id(101));
    await expect(runtime.start({ attempt: h.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    await expect(runtime.retryCompletion(id(103))).resolves.toMatchObject({ state: "draft" });
    expect(h.signClaimantHandoffAsync).toHaveBeenCalledOnce();
    expect(h.handoffSend.mock.calls[1]?.[1]?.body).toBe(h.handoffSend.mock.calls[2]?.[1]?.body);
  });

  it("suppresses a late native result after background cancellation", async () => {
    const h = harness(); let finish!: (value: typeof h.nativeResult) => void;
    h.signClaimantHandoffAsync.mockImplementationOnce(() =>
      new Promise<typeof h.nativeResult>((resolve) => { finish = resolve; }));
    const runtime = createClaimantRuntimeFoundation(h.options); await runtime.activatePortal(id(101));
    const pending = runtime.start({ attempt: h.attempt, sessionAssertionIdempotencyKey: id(102) });
    const rejection = expect(pending).rejects.toMatchObject(unavailable);
    await vi.waitFor(() => expect(h.signClaimantHandoffAsync).toHaveBeenCalledOnce());
    h.emitLifecycle("background"); h.emitLifecycle("foreground"); finish(h.nativeResult);
    await rejection;
    expect(runtime.snapshot()).toMatchObject({ draft_available: false, release_authorized: false });
    await expect(runtime.retryCompletion(id(103))).rejects.toMatchObject(unavailable);
  });

  it("closes on hosted session drift and terminal lifecycle", async () => {
    const drift = harness(); const first = createClaimantRuntimeFoundation(drift.options);
    drift.emitAuth({ ...drift.authenticated, accessToken: "changed-token" });
    await expect(first.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    expect(first.snapshot().status).toBe("closed");
    const terminal = harness(); const second = createClaimantRuntimeFoundation(terminal.options);
    terminal.emitLifecycle("locked");
    await expect(second.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    expect(second.snapshot().status).toBe("closed"); await second.dispose();
  });

  it("preserves exact revoke retry and disposes all boundaries", async () => {
    const h = harness(); const runtime = createClaimantRuntimeFoundation(h.options);
    await runtime.activatePortal(id(101)); h.portalSend.mockRejectedValueOnce(new Error("lost revoke response"));
    await expect(runtime.revokePortal(id(104))).rejects.toMatchObject(unavailable);
    await expect(runtime.retryRevoke()).resolves.toBeUndefined();
    expect(h.portalSend.mock.calls[1]?.[0]).toBe(h.portalSend.mock.calls[2]?.[0]);
    expect(runtime.snapshot().status).toBe("closed"); await runtime.dispose();
  });
});
