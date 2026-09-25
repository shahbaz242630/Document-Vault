import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, type OfflineCodeChallengeV2, type OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import type { OfflineCodeV2SyntheticAttempt } from "../claimant-offline-code/offline-code-v2-coordinator";
import { completion, id, session as portalSession, signature, transcript } from "../claimant-handoff/fixtures.test";
import type { HandoffSend } from "../claimant-handoff/transport";
import type { PortalSessionSend } from "../claimant-session/portal-session-client";
import { createClaimantWholeJourneyAcceptanceHarness } from "./whole-journey-acceptance";

const unavailable = { name: "ClaimantWholeJourneyAcceptanceUnavailableError",
  message: "Claimant whole-journey acceptance is unavailable." };
type Options = Parameters<typeof createClaimantWholeJourneyAcceptanceHarness>[0];

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
  const authenticatedSource = { syntheticOnly: true as const, subscribe(listener: (value: unknown) => void) {
    authListeners.add(listener); listener(authenticated); return () => { authListeners.delete(listener); };
  } };
  const lifecycleSource = { subscribe(listener: (value: unknown) => void) {
    lifecycleListeners.add(listener); listener(lifecycle); return () => { lifecycleListeners.delete(listener); };
  } };
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
  const options: Options = { approved: true, syntheticOnly: true, productionRuntime: false, journey: {
    authenticated: authenticatedSource, lifecycle: lifecycleSource, now: () => time,
    portal: { apiOrigin: "https://api.sanduqkin.test", claimantOrigin: fixture.challenge.origin, send: portalSend },
    bridge: { apiOrigin: "https://api.sanduqkin.test", claimantOrigin: fixture.challenge.origin,
      possessionSend, handoffSend, producer, signer } } };
  return { options, attempt, authenticated, portalResults, portalSend, possessionSend, possessionResponse,
    handoffSend, handoffResponse, issued, producer, signer,
    emitAuth: (value: unknown) => { for (const listener of authListeners) listener(value); },
    emitLifecycle: (state: string) => { lifecycle = { sequence: lifecycle.sequence + 1, state };
      for (const listener of lifecycleListeners) listener(lifecycle); },
    advance: (milliseconds: number) => { time += milliseconds; } };
}

describe("synthetic claimant whole-journey acceptance", () => {
  it("is dormant by default without reading dependencies", async () => {
    const touched = vi.fn(() => { throw new Error("private adapter detail"); });
    const options = Object.defineProperties({}, Object.fromEntries(["syntheticOnly", "productionRuntime", "journey"]
      .map((key) => [key, { get: touched }]))) as Options;
    const acceptance = createClaimantWholeJourneyAcceptanceHarness(options);
    await expect(acceptance.activatePortal(id(1))).rejects.toMatchObject(unavailable);
    expect(acceptance.snapshot().status).toBe("disabled"); expect(touched).not.toHaveBeenCalled();
  });

  it("joins the real synthetic session route to a reconciled closed journey", async () => {
    const h = harness(); const acceptance = createClaimantWholeJourneyAcceptanceHarness(h.options);
    await acceptance.activatePortal(id(101));
    const report = await acceptance.run({ attempt: h.attempt, sessionAssertionIdempotencyKey: id(102) });
    expect(report).toEqual({ status: "accepted", synthetic_only: true, route_profile: "offline_code_v2",
      final_state: "closed", case_version: 10, audit_event_count: 10, claimant_session_bound: true,
      audit_reconciled: true, identity_verified: false, relationship_verified: false,
      release_authorized: false, decryption_authorized: false, runtime_effect: false });
    expect(Object.isFrozen(report)).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/case_id|tenant_id|session_id|accessToken|challenge|signature/iu);
    expect(acceptance.snapshot()).toEqual({ status: "accepted", accepted: true, final_state: "closed",
      claimant_session_bound: true, identity_verified: false, relationship_verified: false,
      release_authorized: false, decryption_authorized: false, runtime_effect: false });
    await acceptance.revokePortal(id(104));
    expect(acceptance.snapshot().status).toBe("closed");
    await acceptance.dispose();
  });

  it("fails before route work when the fresh portal assertion changes", async () => {
    const h = harness(); const acceptance = createClaimantWholeJourneyAcceptanceHarness(h.options);
    await acceptance.activatePortal(id(101));
    h.portalSend.mockResolvedValueOnce(portalResponse({ context: "claimant_portal", sessionVersion: 2 }));
    await expect(acceptance.run({ attempt: h.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    expect(h.possessionSend).not.toHaveBeenCalled(); expect(h.handoffSend).not.toHaveBeenCalled();
    expect(acceptance.snapshot()).toMatchObject({ status: "closed", accepted: false });
  });

  it("delegates exact proof retry before completing the downstream scenario", async () => {
    const h = harness();
    h.possessionSend.mockImplementationOnce(async () => h.possessionResponse(false))
      .mockRejectedValueOnce(new Error("lost proof response"));
    const acceptance = createClaimantWholeJourneyAcceptanceHarness(h.options);
    await acceptance.activatePortal(id(101));
    await expect(acceptance.run({ attempt: h.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    await expect(acceptance.retryProof(id(103))).resolves.toMatchObject({ status: "accepted" });
    expect(h.producer.produce).toHaveBeenCalledOnce();
  });

  it("delegates only the exact ambiguous portal activation retry", async () => {
    const h = harness(); h.portalSend.mockRejectedValueOnce(new Error("lost activation response"));
    const acceptance = createClaimantWholeJourneyAcceptanceHarness(h.options);
    await expect(acceptance.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    await expect(acceptance.retryActivation()).resolves.toBeUndefined();
    expect(h.portalSend.mock.calls[0]?.[0]).toBe(h.portalSend.mock.calls[1]?.[0]);
    expect(h.portalSend.mock.calls[0]?.[1].headers).toBe(h.portalSend.mock.calls[1]?.[1].headers);
  });

  it("delegates exact completion retry without signing twice", async () => {
    const h = harness();
    h.handoffSend.mockImplementationOnce(async () => h.handoffResponse(h.issued))
      .mockRejectedValueOnce(new Error("lost completion response"));
    const acceptance = createClaimantWholeJourneyAcceptanceHarness(h.options);
    await acceptance.activatePortal(id(101));
    await expect(acceptance.run({ attempt: h.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    await expect(acceptance.retryCompletion(id(103))).resolves.toMatchObject({ status: "accepted" });
    expect(h.handoffSend.mock.calls[1]?.[1]?.body).toBe(h.handoffSend.mock.calls[2]?.[1]?.body);
    expect(h.signer.sign).toHaveBeenCalledOnce();
  });

  it("suppresses late completion after cancellation and never produces a report", async () => {
    const h = harness(); let finish!: (value: Response) => void;
    h.handoffSend.mockImplementationOnce(async () => h.handoffResponse(h.issued))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const acceptance = createClaimantWholeJourneyAcceptanceHarness(h.options);
    await acceptance.activatePortal(id(101));
    const pending = acceptance.run({ attempt: h.attempt, sessionAssertionIdempotencyKey: id(102) });
    await vi.waitFor(() => expect(h.handoffSend).toHaveBeenCalledTimes(2));
    acceptance.cancel(); finish(h.handoffResponse(completion));
    await expect(pending).rejects.toMatchObject(unavailable);
    expect(acceptance.snapshot()).toMatchObject({ accepted: false, final_state: null });
    await expect(acceptance.retryCompletion(id(103))).rejects.toMatchObject(unavailable);
  });

  it("rejects authority-expanded completion and terminal lifecycle state", async () => {
    const expanded = harness();
    expanded.handoffSend.mockImplementationOnce(async () => expanded.handoffResponse(expanded.issued))
      .mockImplementationOnce(async () => expanded.handoffResponse({ ...completion, release_authorized: true }));
    const first = createClaimantWholeJourneyAcceptanceHarness(expanded.options);
    await first.activatePortal(id(101));
    await expect(first.run({ attempt: expanded.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    expect(first.snapshot().accepted).toBe(false);

    const terminal = harness(); const second = createClaimantWholeJourneyAcceptanceHarness(terminal.options);
    terminal.emitLifecycle("locked");
    await expect(second.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    expect(second.snapshot().status).toBe("closed");
  });

  it("delegates only the exact ambiguous revoke retry and closes", async () => {
    const h = harness(); const acceptance = createClaimantWholeJourneyAcceptanceHarness(h.options);
    await acceptance.activatePortal(id(101));
    h.portalSend.mockRejectedValueOnce(new Error("lost revoke response"));
    await expect(acceptance.revokePortal(id(104))).rejects.toMatchObject(unavailable);
    await expect(acceptance.retryRevoke()).resolves.toBeUndefined();
    expect(h.portalSend.mock.calls[1]?.[0]).toBe(h.portalSend.mock.calls[2]?.[0]);
    expect(h.portalSend.mock.calls[1]?.[1].headers).toBe(h.portalSend.mock.calls[2]?.[1].headers);
    expect(acceptance.snapshot().status).toBe("closed");
  });

  it("closes on authentication drift and disposes awaitably", async () => {
    const h = harness(); const acceptance = createClaimantWholeJourneyAcceptanceHarness(h.options);
    h.emitAuth({ ...h.authenticated, accessToken: "changed-token" });
    await expect(acceptance.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    await acceptance.dispose();
    expect(acceptance.snapshot().status).toBe("closed");
    h.advance(700_000);
  });
});
