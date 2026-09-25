import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, type OfflineCodeChallengeV2, type OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import type { OfflineCodeV2SyntheticAttempt } from "../claimant-offline-code/offline-code-v2-coordinator";
import { completion, id, session as portalSession, signature, transcript } from "../claimant-handoff/fixtures.test";
import type { HandoffSend } from "../claimant-handoff/transport";
import type { PortalSessionSend } from "../claimant-session/portal-session-client";
import { createClaimantSessionJourneyComposition } from "./session-journey-composition";

const unavailable = { name: "ClaimantSessionJourneyUnavailableError",
  message: "Claimant session journey is unavailable." };
type Options = Parameters<typeof createClaimantSessionJourneyComposition>[0];

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
      challenge: OfflineCodeChallengeV2;
      possession_proof: OfflineCodePossessionProofV2;
    };
  let time = Date.parse(fixture.challenge.issued_at) + 1_000;
  const authenticated = Object.freeze({ syntheticOnly: true as const, userId: portalSession.userId,
    sessionId: portalSession.sessionId, accessToken: portalSession.accessToken, aal: "aal2" as const,
    recovery: false as const, expiresAt: time + 600_000, assuredAt: time });
  const authListeners = new Set<(value: unknown) => void>();
  const lifecycleListeners = new Set<(value: unknown) => void>();
  let lifecycle = { sequence: 0, state: "foreground" };
  const authCleanup = vi.fn(); const lifecycleCleanup = vi.fn();
  const authenticatedSource = { syntheticOnly: true as const, subscribe: vi.fn((listener: (value: unknown) => void) => {
    authListeners.add(listener); listener(authenticated); return () => { authListeners.delete(listener); authCleanup(); };
  }) };
  const lifecycleSource = { subscribe: vi.fn((listener: (value: unknown) => void) => {
    lifecycleListeners.add(listener); listener(lifecycle); return () => {
      lifecycleListeners.delete(listener); lifecycleCleanup();
    };
  }) };
  const portalResults = {
    activate: { context: "claimant_portal", sessionVersion: 1, displacedPrevious: false, replayed: false },
    assert: { context: "claimant_portal", sessionVersion: 1 },
    revoke: { context: "claimant_portal", sessionVersion: 2, revoked: true, replayed: false },
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
  const signer = { syntheticOnly: true as const, sign: vi.fn(async () => signature) };
  const possession = { syntheticOnly: true as const, publicLocator: fixture.public_locator,
    clientSecret: fixture.synthetic_client_secret, kdfProfile: fixture.kdf_profile,
    recordBinding: fixture.record_binding, challengeIdempotencyKey: id(91), proofIdempotencyKey: id(92) };
  const attempt = { possession, issueIdempotencyKey: id(93), completionIdempotencyKey: id(94) };
  const options: Options = { approved: true, syntheticOnly: true, productionRuntime: false,
    authenticated: authenticatedSource, lifecycle: lifecycleSource, now: () => time,
    portal: { apiOrigin: "https://api.sanduqkin.test", claimantOrigin: fixture.challenge.origin, send: portalSend },
    bridge: { apiOrigin: "https://api.sanduqkin.test", claimantOrigin: fixture.challenge.origin,
      possessionSend, handoffSend, producer, signer } };
  return { options, attempt, authenticated, portalResults, portalSend, possessionSend, possessionResponse,
    handoffSend, handoffResponse, issued,
    producer, signer, authCleanup, lifecycleCleanup,
    emitAuth: (value: unknown) => { for (const listener of authListeners) listener(value); },
    emitLifecycle: (state: string) => { lifecycle = { sequence: lifecycle.sequence + 1, state };
      for (const listener of lifecycleListeners) listener(lifecycle); },
    emitRawLifecycle: (value: unknown) => { for (const listener of lifecycleListeners) listener(value); },
    advance: (milliseconds: number) => { time += milliseconds; },
  };
}

describe("synthetic claimant session journey composition", () => {
  it("is dormant by default without reading any dependency", async () => {
    const touched = vi.fn(() => { throw new Error("private adapter detail"); });
    const options = Object.defineProperties({}, Object.fromEntries(["syntheticOnly", "productionRuntime",
      "authenticated", "lifecycle", "portal", "bridge", "now"].map((key) => [key, { get: touched }]))) as Options;
    const journey = createClaimantSessionJourneyComposition(options);
    await expect(journey.activatePortal(id(1))).rejects.toMatchObject(unavailable);
    expect(journey.snapshot().status).toBe("disabled"); expect(touched).not.toHaveBeenCalled();
  });

  it("fails closed unless authentication and lifecycle are established synchronously", async () => {
    const noAuth = harness();
    const first = createClaimantSessionJourneyComposition({ ...noAuth.options,
      authenticated: { syntheticOnly: true, subscribe: () => () => undefined } });
    expect(first.snapshot().status).toBe("closed");
    await expect(first.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    const noLifecycle = harness();
    const second = createClaimantSessionJourneyComposition({ ...noLifecycle.options,
      lifecycle: { subscribe: () => () => undefined } });
    expect(second.snapshot().status).toBe("closed");
  });

  it("activates, freshly asserts, and returns only the frozen safe draft", async () => {
    const h = harness(); const journey = createClaimantSessionJourneyComposition(h.options);
    await journey.activatePortal(id(101));
    const draft = await journey.start({ attempt: h.attempt, sessionAssertionIdempotencyKey: id(102) });
    expect(h.portalSend.mock.calls.map(([url]) => url.split("/").at(-1))).toEqual(["activate", "assert"]);
    expect(draft).toEqual({ state: "draft", route_profile: "offline_code_v2", case_version: 1,
      claimant_session_bound: true, case_created: true, identity_verified: false,
      relationship_verified: false, intake_started: false, review_started: false,
      release_authorized: false });
    expect(Object.isFrozen(draft)).toBe(true);
    expect(JSON.stringify(draft)).not.toContain(h.authenticated.accessToken);
    expect(journey.snapshot()).toEqual({ status: "draft", portal_session_active: true,
      draft_available: true, identity_verified: false, relationship_verified: false,
      intake_started: false, review_started: false, release_authorized: false });
    await journey.dispose();
  });

  it("fails server assertion before possession, handoff, proof, or signing work", async () => {
    const h = harness(); const journey = createClaimantSessionJourneyComposition(h.options);
    await journey.activatePortal(id(101));
    h.portalSend.mockResolvedValueOnce(portalResponse({ context: "claimant_portal", sessionVersion: 2 }));
    await expect(journey.start({ attempt: h.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    expect(h.possessionSend).not.toHaveBeenCalled(); expect(h.handoffSend).not.toHaveBeenCalled();
    expect(h.producer.produce).not.toHaveBeenCalled(); expect(h.signer.sign).not.toHaveBeenCalled();
    expect(journey.snapshot().status).toBe("closed");
  });

  it("closes permanently on authenticated-session drift or expiry", async () => {
    const drift = harness(); const first = createClaimantSessionJourneyComposition(drift.options);
    drift.emitAuth({ ...drift.authenticated, accessToken: "changed-token" });
    drift.emitAuth(drift.authenticated);
    await expect(first.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    expect(first.snapshot().status).toBe("closed");
    const expiry = harness(); const second = createClaimantSessionJourneyComposition(expiry.options);
    expiry.advance(600_001);
    await expect(second.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    expect(second.snapshot().status).toBe("closed");
  });

  it("cancels background activation and suppresses its late session", async () => {
    const h = harness(); let finish!: (value: Response) => void;
    h.portalSend.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const journey = createClaimantSessionJourneyComposition(h.options);
    const pending = journey.activatePortal(id(101));
    await vi.waitFor(() => expect(h.portalSend).toHaveBeenCalledOnce());
    h.emitLifecycle("background"); h.emitLifecycle("foreground");
    finish(portalResponse(h.portalResults.activate));
    await expect(pending).rejects.toMatchObject(unavailable);
    expect(journey.snapshot()).toMatchObject({ status: "ready", portal_session_active: false,
      draft_available: false });
    await expect(journey.retryActivation()).rejects.toMatchObject(unavailable);
    await journey.dispose();
  });

  it("denies overlapping journey work", async () => {
    const h = harness(); let finish!: (value: Response) => void;
    h.portalSend.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const journey = createClaimantSessionJourneyComposition(h.options);
    const pending = journey.activatePortal(id(101));
    await vi.waitFor(() => expect(h.portalSend).toHaveBeenCalledOnce());
    await expect(journey.activatePortal(id(102))).rejects.toMatchObject(unavailable);
    journey.cancel(); finish(portalResponse(h.portalResults.activate));
    await expect(pending).rejects.toMatchObject(unavailable);
    await journey.dispose();
  });

  it("delegates an exact ambiguous activation retry before composing", async () => {
    const h = harness(); h.portalSend.mockRejectedValueOnce(new Error("lost response"));
    const journey = createClaimantSessionJourneyComposition(h.options);
    await expect(journey.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    await expect(journey.retryActivation()).resolves.toMatchObject({ sessionVersion: 1 });
    expect(h.portalSend.mock.calls[0][0]).toBe(h.portalSend.mock.calls[1][0]);
    expect(h.portalSend.mock.calls[0][1].headers).toBe(h.portalSend.mock.calls[1][1].headers);
    expect(journey.snapshot()).toMatchObject({ status: "active", portal_session_active: true });
    await journey.dispose();
  });

  it("asserts freshly before delegating the exact proof retry", async () => {
    const h = harness();
    h.possessionSend.mockImplementationOnce(async () => h.possessionResponse(false))
      .mockRejectedValueOnce(new Error("lost proof response"));
    const journey = createClaimantSessionJourneyComposition(h.options);
    await journey.activatePortal(id(101));
    await expect(journey.start({ attempt: h.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    await expect(journey.retryProof(id(103))).resolves.toMatchObject({ state: "draft" });
    expect(h.portalSend.mock.calls.map(([url]) => url.split("/").at(-1))).toEqual(["activate", "assert", "assert"]);
    expect(h.producer.produce).toHaveBeenCalledOnce();
    await journey.dispose();
  });

  it("asserts freshly before delegating the exact completion retry", async () => {
    const h = harness();
    h.handoffSend.mockImplementationOnce(async () => h.handoffResponse(h.issued))
      .mockRejectedValueOnce(new Error("lost completion response"));
    const journey = createClaimantSessionJourneyComposition(h.options);
    await journey.activatePortal(id(101));
    await expect(journey.start({ attempt: h.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    await expect(journey.retryCompletion(id(103))).resolves.toMatchObject({ state: "draft" });
    expect(h.portalSend.mock.calls.map(([url]) => url.split("/").at(-1))).toEqual(["activate", "assert", "assert"]);
    expect(h.handoffSend.mock.calls[1]?.[1]?.body).toBe(h.handoffSend.mock.calls[2]?.[1]?.body);
    expect(h.signer.sign).toHaveBeenCalledOnce();
    await journey.dispose();
  });

  it("suppresses a late bridge result after explicit cancellation", async () => {
    const h = harness(); let finish!: (value: Response) => void;
    h.handoffSend.mockImplementationOnce(async () => h.handoffResponse(h.issued))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const journey = createClaimantSessionJourneyComposition(h.options);
    await journey.activatePortal(id(101));
    const pending = journey.start({ attempt: h.attempt, sessionAssertionIdempotencyKey: id(102) });
    await vi.waitFor(() => expect(h.handoffSend).toHaveBeenCalledTimes(2));
    journey.cancel(); finish(h.handoffResponse(completion));
    await expect(pending).rejects.toMatchObject(unavailable);
    expect(journey.snapshot()).toMatchObject({ status: "active", portal_session_active: true,
      draft_available: false });
    await expect(journey.retryCompletion(id(103))).rejects.toMatchObject(unavailable);
    await journey.dispose();
  });

  it("preserves only exact revoke retry authority and then closes", async () => {
    const h = harness(); const journey = createClaimantSessionJourneyComposition(h.options);
    await journey.activatePortal(id(101));
    h.portalSend.mockRejectedValueOnce(new Error("lost revoke response"));
    await expect(journey.revokePortal(id(104))).rejects.toMatchObject(unavailable);
    await expect(journey.retryRevoke()).resolves.toBeUndefined();
    expect(h.portalSend.mock.calls[1][0]).toBe(h.portalSend.mock.calls[2][0]);
    expect(h.portalSend.mock.calls[1][1].headers).toBe(h.portalSend.mock.calls[2][1].headers);
    expect(journey.snapshot()).toMatchObject({ status: "closed", portal_session_active: false,
      draft_available: false });
  });

  it("closes on regressing or terminal lifecycle and disposes its sources", async () => {
    const regressing = harness(); const first = createClaimantSessionJourneyComposition(regressing.options);
    regressing.emitLifecycle("background"); regressing.emitRawLifecycle({ sequence: 0, state: "foreground" });
    expect(first.snapshot().status).toBe("closed");
    const terminal = harness(); const second = createClaimantSessionJourneyComposition(terminal.options);
    terminal.emitLifecycle("locked");
    await expect(second.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    await second.dispose();
    expect(second.snapshot().status).toBe("closed");
    expect(terminal.authCleanup).toHaveBeenCalledOnce();
    expect(terminal.lifecycleCleanup).toHaveBeenCalledOnce();
  });
});
